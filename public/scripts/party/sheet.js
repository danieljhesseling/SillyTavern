/**
 * La ficha de un personaje: la ventana con sus pestañas (hoja, inventario, progreso,
 * relaciones y recuerdos), la tuya de mirar, los juegos de ropa, dar algo a otro y lo maldito.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { t } from '../i18n.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from '../popup.js';
import { chat, chat_metadata, setUserName } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, METADATA_KEY } from '../world-info.js';
import {
    EQUIPMENT_SLOTS, SLOT_INFO, RELATIONSHIP_CATEGORIES, RELATIONSHIP_SCORE_MIN, RELATIONSHIP_SCORE_MAX,
    MODIFIABLE_STATS, ALIGNMENTS, CONDITIONS, generateMemoryId, getAbilityModifier, formatModifier,
    calculateCarryingCapacity, calculateTotalWeight, getDefaultDndData, applyEquipmentEffects, addItemToInventory,
    removeItemFromInventory, consumeItemInInventory, equipItem, unequipItem, getEquippedItem, getItemsByType,
    analyzeRelationshipsFromChat, migratePartyMember, createItem, getItemCategoryOptions,
    getItemSubcategoryOptions, getSuggestedSlotForItem, buildItemMetaSummary, normalizeItem, getArmorDexRuleLabel,
    isMeleeWeaponSubcategory, getMagicSubtypeFlags, clampRelationshipScore,
} from '../dnd-system.js';
import { escapeHtml } from '../utils.js';
import { escItemText, buildPartyItemSections } from './item-forms.js';
import { shieldBlocked } from '../game-engine/rules/equipment.js';
import { languagesOf } from '../game-engine/rules/languages.js';
import { saveSet, applySet, readSets } from '../game-engine/rules/equipment-sets.js';
import { giveItem } from '../game-engine/rules/give-item.js';
import { setInjury } from '../game-engine/rules/injuries.js';
import { canTakeOff, shownName, curseInjury } from '../game-engine/campaign/item-lore.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { combatEncounter, partyMembers } from './state.js';
import {
    savePartyState, getPartyEntryDisplayName, loadDndCatalog, renderPartyMembers, postCombatNarration,
    getCampaignBonds,
} from './main.js';
import { canLevelUp, openLevelUpCard } from './level-up.js';
import { getAbilityCatalogue } from './magic.js';
import { getCurrentWorldFactions } from './factions.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */
/** @typedef {import('./types.js').DndCatalog} DndCatalog */

/**
 * @param {PartyMember} member
 * @returns {string|null}
 */
function getMemberWorldName(member) {
    return member.worldName || (chat_metadata ? chat_metadata[METADATA_KEY] : null) || null;
}

/**
 * @param {PartyMember} member
 * @param {Partial<PartyMember>} preset
 */
function applyClassPresetToMember(member, preset) {
    const assignIfNumber = (key, value) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
            /** @type {any} */ (member)[key] = value;
        }
    };

    assignIfNumber('strength', preset.strength);
    assignIfNumber('dexterity', preset.dexterity);
    assignIfNumber('constitution', preset.constitution);
    assignIfNumber('intelligence', preset.intelligence);
    assignIfNumber('wisdom', preset.wisdom);
    assignIfNumber('charisma', preset.charisma);
    assignIfNumber('armorClass', preset.armorClass);
    assignIfNumber('speed', preset.speed);
    assignIfNumber('maxHp', preset.maxHp);
    assignIfNumber('hp', preset.hp);
    if (member.hp > member.maxHp) {
        member.hp = member.maxHp;
    }
    member.classPresetSource = member.class;
    member.classPresetDirty = false;
}

function memberHasLikelyEditedStats(member) {
    if (member.classPresetDirty) return true;
    const defaults = getDefaultDndData();
    const deviatesFromDefaults =
        member.strength !== defaults.strength
        || member.dexterity !== defaults.dexterity
        || member.constitution !== defaults.constitution
        || member.intelligence !== defaults.intelligence
        || member.wisdom !== defaults.wisdom
        || member.charisma !== defaults.charisma
        || member.armorClass !== defaults.armorClass
        || member.speed !== defaults.speed;
    return deviatesFromDefaults;
}

/**
 * Syncs a party member's data back to the corresponding World Info entry.
 * @param {PartyMember} member
 */
async function syncPartyMemberToWorldInfo(member) {
    if (member.wiUid == null || !member.worldName) return;

    try {
        const data = /** @type {any} */ (await loadWorldInfo(member.worldName));
        if (!data?.entries) return;

        const entry = data.entries[member.wiUid];
        if (!entry) {
            console.warn('syncPartyMemberToWorldInfo: entry not found', { wiUid: member.wiUid, worldName: member.worldName });
            return;
        }

        // Update entry fields from party member
        entry.comment = member.name;
        if (!entry.dndData) entry.dndData = {};
        entry.dndData.image = member.avatar;
        entry.dndData.level = member.level;
        entry.dndData.charClass = member.class;
        entry.dndData.race = member.race || '';
        entry.dndData.factions = Array.isArray(member.factions) ? member.factions : [];
        entry.dndData.locationName = member.mapPosition?.locationName || '';
        entry.dndData.maxHp = member.maxHp;
        entry.dndData.alignment = member.alignment;
        entry.dndData.personality = member.personality;
        entry.dndData.str = member.strength;
        entry.dndData.dex = member.dexterity;
        entry.dndData.con = member.constitution;
        entry.dndData.int = member.intelligence;
        entry.dndData.wis = member.wisdom;
        entry.dndData.cha = member.charisma;
        entry.dndData.ac = member.armorClass;
        entry.dndData.speed = member.speed;
        entry.dndData.name = member.name;

        await saveWorldInfo(member.worldName, data, true);
        console.log('syncPartyMemberToWorldInfo synced', { member: member.name, wiUid: member.wiUid });
    } catch (e) {
        console.warn('syncPartyMemberToWorldInfo failed', e);
    }
}

/**
 * Tu ficha, la de mirar.
 *
 * @param {any} member
 * @returns {Promise<void>}
 */
export async function openOwnSheet(member) {
    const rules = getActiveRuleset();
    const { openCharacterPanel } = await import('../game-engine/ui/character-panel.js');

    // Lo que se toca en la ficha (dar algo, ponerse un juego) la cierra; se vuelve a abrir
    // al día, hasta que se cierra sin tocar nada.
    for (let open = 0; open < 20; open++) {
        const result = await openCharacterPanel({
            member,
            slotInfo: rules?.slotInfo ?? {},
            abilities: getAbilityCatalogue(),
            xpTable: rules?.progression?.xpThresholds ?? null,
            bondRank: Number(getCampaignBonds()?.[String(member.id)]?.rank) || 0,
            onEdit: () => { void openPartyMemberModal(member); },
            // Idea 59: lo que habla.
            languages: languagesOf(member),
            // Idea 62: sus juegos de equipo.
            sets: readSets(member),
            onSaveSet: (name) => wearSet(member, name, 'save'),
            onApplySet: (name) => wearSet(member, name, 'apply'),
            // Idea 163: a quién darle algo.
            mates: partyMembers.filter(m => m !== member && !m.dead)
                .map(m => ({ id: String(m.id), name: String(m.name), avatar: String(m.avatar || '') })),
            onGive: (itemId, toId) => handItem(member, itemId, toId),
            Popup,
            POPUP_TYPE,
        });
        if (result !== 'changed') break;
    }
}

/**
 * Idea 62: guardar lo que se lleva puesto con un nombre, o ponerse un juego guardado. Lo
 * maldito que no se suelta se queda donde está.
 *
 * @param {any} member
 * @param {string} name
 * @param {'save'|'apply'} what
 * @returns {boolean}
 */
function wearSet(member, name, what) {
    if (what === 'save') {
        const saved = saveSet(member, name);
        if (!saved.ok) {
            toastr.warning(saved.line);
            return false;
        }
        member.equipmentSets = saved.sets;
        savePartyState();
        toastr.success(saved.line, 'Juego de equipo');
        return true;
    }
    if (combatEncounter.active) {
        toastr.warning('En combate no hay tiempo de cambiarse de todo.');
        return false;
    }
    const worn = applySet(member, name, (slot) => {
        const id = member.equippedItems?.[slot];
        return Boolean((member.items ?? []).find((/** @type {any} */ i) => i.id === id)?.cursed);
    });
    if (!worn.ok) {
        toastr.warning(worn.line);
        return false;
    }
    member.equippedItems = worn.equippedItems;
    // Lo maldito que uno se pone se descubre al ponérselo, como con una pieza suelta.
    for (const id of Object.values(worn.equippedItems)) {
        const item = (member.items ?? []).find((/** @type {any} */ i) => i.id === id);
        if (item?.cursed && item.identified === false) {
            item.identified = true;
            toastr.error(`${item.name} se os pega a la mano: ${item.curse?.label ?? 'está maldito'}.`, 'Maldito', { timeOut: 12000 });
        }
    }
    syncCurse(member);
    savePartyState();
    renderPartyMembers();
    toastr.success(worn.line, 'Juego de equipo');
    return true;
}

/**
 * Idea 163: darle algo a otro del grupo.
 *
 * @param {any} member
 * @param {string} itemId
 * @param {string} toId
 * @returns {boolean}
 */
function handItem(member, itemId, toId) {
    const to = partyMembers.find(m => String(m.id) === String(toId));
    const given = giveItem({ from: member, to, itemId });
    if (!given.ok || !given.from || !given.to || !to) {
        toastr.warning(given.reason || 'No se puede.');
        return false;
    }
    member.items = given.from.items;
    member.equippedItems = given.from.equippedItems;
    to.items = given.to.items;
    syncCurse(member);
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`🎒 [GRUPO] ${given.line}`);
    toastr.success(given.line, 'Repartir');
    return true;
}

/**
 * Idea 135: lo maldito que se lleva puesto resta, como una herida. Se vuelve a mirar cada
 * vez que se pone o se quita algo, y al quitar la maldición.
 *
 * @param {any} member
 */
export function syncCurse(member) {
    const patch = setInjury(member, curseInjury(member), 'curse');
    member.injuries = patch.injuries;
    member.baseStats = patch.baseStats;
    Object.assign(member, patch.stats);
}

/**
 * Idea 135: soltar lo que se lleva, salvo que esté maldito.
 *
 * @param {any} member
 * @param {string} slot
 * @returns {boolean}
 */
function tryUnequip(member, slot) {
    const worn = (member.items ?? []).find((/** @type {any} */ i) => i.id === member.equippedItems?.[slot]);
    const off = canTakeOff(worn);
    if (!off.ok) {
        toastr.warning(off.reason, 'Maldito');
        return false;
    }
    unequipItem(member, slot);
    syncCurse(member);
    savePartyState();
    return true;
}

/**
 * Idea 135: ponerse algo. Lo que ya está en esa ranura y está maldito no se deja quitar, y
 * lo maldito que uno se pone se descubre al ponérselo.
 *
 * @param {any} member
 * @param {string} itemId
 * @param {string} slot
 * @returns {boolean}
 */
function tryEquip(member, itemId, slot) {
    const worn = (member.items ?? []).find((/** @type {any} */ i) => i.id === member.equippedItems?.[slot]);
    if (worn && worn.id !== itemId && !canTakeOff(worn).ok) {
        toastr.warning(canTakeOff(worn).reason, 'Maldito');
        return false;
    }
    equipItem(member, itemId, slot);
    const item = (member.items ?? []).find((/** @type {any} */ i) => i.id === itemId);
    if (item?.cursed && item.identified === false) {
        item.identified = true;
        toastr.error(`${item.name} se os pega a la mano: ${item.curse?.label ?? 'está maldito'}. ${item.curse?.note ?? ''}`, 'Maldito', { timeOut: 12000 });
    }
    syncCurse(member);
    savePartyState();
    return true;
}

/**
 * @param {PartyMember} member
 */
export async function openPartyMemberModal(member) {
    // Ensure member has all D&D fields
    const m = migratePartyMember(member);
    Object.assign(member, m);

    const popupContent = $('<div class="dnd-modal"></div>');
    const dndCatalog = await loadDndCatalog(getMemberWorldName(member));

    // ---- Tab bar ----
    const tabs = ['Character Sheet', 'Inventory', 'Progression', 'Relationships', 'Memories'];
    const tabBar = $('<div class="dnd-tabs"></div>');
    for (const tabName of tabs) {
        const tabId = tabName.toLowerCase().replace(/\s+/g, '_');
        tabBar.append(`<div class="dnd-tab" data-tab="${tabId}">${tabName}</div>`);
    }
    popupContent.append(tabBar);

    // ---- Tab panels ----
    popupContent.append(buildCharacterSheetTab(member, dndCatalog));
    popupContent.append(buildInventoryTab(member));
    popupContent.append(buildProgressionTab(member, dndCatalog));
    popupContent.append(buildRelationshipsTab(member));
    popupContent.append(buildMemoriesTab(member));

    // ---- Tab switching ----
    popupContent.find('.dnd-tab').on('click', function () {
        const tabId = $(this).data('tab');
        popupContent.find('.dnd-tab').removeClass('active');
        $(this).addClass('active');
        popupContent.find('.dnd-tab-panel').removeClass('active');
        popupContent.find(`.dnd-tab-panel[data-panel="${tabId}"]`).addClass('active');
    });

    // Activate first tab
    popupContent.find('.dnd-tab').first().addClass('active');
    popupContent.find('.dnd-tab-panel').first().addClass('active');

    const popup = new Popup(popupContent, POPUP_TYPE.TEXT, '', {
        wide: true,
        wider: true,
        allowVerticalScrolling: true,
        okButton: t`Close`,
    });

    await popup.show();

    // Save changes on close
    const idx = partyMembers.findIndex(p => p.id === member.id);
    if (idx !== -1) {
        partyMembers[idx] = member;
        renderPartyMembers();
        savePartyState();
        // Sync changes back to World Info entry
        syncPartyMemberToWorldInfo(member);
        // If this is the party leader, update the active chat speaker name
        if (idx === 0) {
            setUserName(member.name, { toastPersonaNameChange: false });
        }
    }
}

/**
 * @param {PartyMember} member
 * @param {DndCatalog} dndCatalog
 * @returns {JQuery}
 */
function buildCharacterSheetTab(member, dndCatalog) {
    const panel = $('<div class="dnd-tab-panel" data-panel="character_sheet"></div>');
    const sheet = $('<div class="dnd-sheet"></div>');

    // Header (editable name + clickable avatar)
    const header = $(`
        <div class="dnd-sheet-header">
            <div class="dnd-avatar-wrapper" title="Click to change avatar">
                <img class="dnd-sheet-avatar" src="${member.avatar}" alt="${member.name}" />
                <div class="dnd-avatar-overlay"><i class="fa-solid fa-camera"></i></div>
                <input type="file" class="dnd-avatar-input" accept="image/*" style="display:none" />
            </div>
            <div class="dnd-sheet-identity">
                <input type="text" class="dnd-sheet-name-input" value="${member.name}" placeholder="Character name" />
                <div class="dnd-sheet-class-level">${[member.race, `Level ${member.level} ${member.class}`].filter(Boolean).join(' · ')}</div>
            </div>
        </div>
    `);

    // Name editing
    header.find('.dnd-sheet-name-input').on('change', function () {
        const newName = String($(this).val()).trim();
        if (newName) {
            member.name = newName;
        }
    });

    // Avatar click -> open file picker
    header.find('.dnd-avatar-wrapper').on('click', function (e) {
        if ($(e.target).hasClass('dnd-avatar-input')) return;
        header.find('.dnd-avatar-input')[0].click();
    });

    // Avatar file selected -> convert to data URL
    header.find('.dnd-avatar-input').on('change', function () {
        const file = /** @type {HTMLInputElement} */ (this).files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target?.result;
            if (typeof dataUrl === 'string') {
                member.avatar = dataUrl;
                header.find('.dnd-sheet-avatar').attr('src', dataUrl);
            }
        };
        reader.readAsDataURL(file);
    });

    sheet.append(header);

    const renderIdentitySubtitle = () => {
        header.find('.dnd-sheet-class-level').text([member.race, `Level ${member.level} ${member.class}`].filter(Boolean).join(' · '));
    };

    // Race / Factions / Location
    const identityRow = $(`
        <div class="dnd-field-row" style="gap:8px;align-items:flex-start;">
            <div style="flex:1;min-width:160px;">
                <label class="dnd-field-label">Race:</label>
                <select class="dnd-race-select text_pole"></select>
            </div>
            <div style="flex:1;min-width:180px;">
                <label class="dnd-field-label">Factions:</label>
                <select class="dnd-faction-select text_pole" multiple></select>
            </div>
            <div style="flex:1;min-width:180px;">
                <label class="dnd-field-label">Location:</label>
                <select class="dnd-location-select text_pole"></select>
            </div>
        </div>
    `);

    const raceOptions = Array.from(new Set([...(dndCatalog.races || []), String(member.race || '').trim()].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const raceSelect = identityRow.find('.dnd-race-select');
    raceSelect.append('<option value="">—</option>');
    for (const race of raceOptions) {
        raceSelect.append(`<option value="${escapeHtml(race)}">${escapeHtml(race)}</option>`);
    }
    raceSelect.val(member.race || '');
    raceSelect.on('change', function () {
        member.race = String($(this).val() || '').trim();
        renderIdentitySubtitle();
    });

    // Las del mundo primero: son las que tienen planes y reloj, asi que poner a alguien
    // en una de ellas le da un motivo de verdad. Las escritas a mano siguen valiendo.
    const factionOptions = Array.from(new Set([
        ...getCurrentWorldFactions().map((/** @type {any} */ f) => String(f?.name || '')),
        ...(dndCatalog.factions || []),
        ...(member.factions || []),
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const factionSelect = identityRow.find('.dnd-faction-select');
    for (const faction of factionOptions) {
        factionSelect.append(`<option value="${escapeHtml(faction)}">${escapeHtml(faction)}</option>`);
    }
    factionSelect.val(Array.isArray(member.factions) ? member.factions : []);
    factionSelect.on('change', function () {
        // .val() returns an array for a multiple select, but a bare string otherwise;
        // calling .map() on that string would throw.
        const selected = $(this).val();
        const values = Array.isArray(selected) ? selected : (selected === null || selected === undefined || selected === '' ? [] : [selected]);
        member.factions = values.map(x => String(x));
    });

    const locationOptions = Array.from(new Set([...(dndCatalog.locations || []), String(member.mapPosition?.locationName || '').trim()].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const locationSelect = identityRow.find('.dnd-location-select');
    locationSelect.append('<option value="">—</option>');
    for (const location of locationOptions) {
        locationSelect.append(`<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`);
    }
    locationSelect.val(member.mapPosition?.locationName || '');
    locationSelect.on('change', function () {
        member.mapPosition = member.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
        member.mapPosition.locationName = String($(this).val() || '').trim();
    });

    sheet.append(identityRow);

    // Alignment
    const alignmentRow = $('<div class="dnd-alignment-row"></div>');
    const alignmentSelect = $(`
        <div class="dnd-field-row">
            <label class="dnd-field-label">Alignment:</label>
            <select class="dnd-alignment-select">
                <option value="">— None —</option>
            </select>
        </div>
    `);
    const sel = alignmentSelect.find('select');
    for (const a of ALIGNMENTS) {
        sel.append(`<option value="${a}" ${member.alignment === a ? 'selected' : ''}>${a}</option>`);
    }
    sel.on('change', function () {
        member.alignment = String($(this).val());
    });
    alignmentRow.append(alignmentSelect);
    sheet.append(alignmentRow);

    // Personality
    sheet.append(`
        <div class="dnd-field-row">
            <label class="dnd-field-label">Personality:</label>
            <textarea class="dnd-personality-input" rows="2" placeholder="Brave, impulsive, protective of friends...">${member.personality || ''}</textarea>
        </div>
    `);
    sheet.find('.dnd-personality-input').on('change', function () {
        member.personality = String($(this).val());
    });

    // Ability Scores
    sheet.append('<div class="dnd-section-title">Stats</div>');
    const statsGrid = $('<div class="dnd-stats-grid"></div>');
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    for (const ability of abilities) {
        const value = /** @type {any} */ (member)[ability] || 10;
        const mod = getAbilityModifier(value);
        const box = $(`
            <div class="dnd-stat-box">
                <div class="dnd-stat-label">${ability.charAt(0).toUpperCase() + ability.slice(1)}</div>
                <input type="number" class="dnd-stat-value" data-stat="${ability}" value="${value}" min="1" max="30" />
                <div class="dnd-stat-modifier">${formatModifier(mod)}</div>
            </div>
        `);

        box.find('input').on('change', function () {
            const val = parseInt(String($(this).val()), 10) || 10;
            /** @type {any} */ (member)[ability] = val;
            member.classPresetDirty = true;
            $(this).siblings('.dnd-stat-modifier').text(formatModifier(getAbilityModifier(val)));
        });

        statsGrid.append(box);
    }
    sheet.append(statsGrid);

    // Derived stats
    const eqEffects = applyEquipmentEffects(member);
    const derivedRow = $('<div class="dnd-derived-row"></div>');

    const acBox = $('<div class="dnd-derived-box"></div>');
    const acLabel = $('<div class="dnd-derived-label">Armor Class</div>');
    if (eqEffects.acBonus !== 0) {
        acLabel.append(`<span class="dnd-ac-bonus">${eqEffects.acBonus > 0 ? '+' : ''}${eqEffects.acBonus}</span>`);
    }
    acBox.append(acLabel);
    if (eqEffects.acBonus !== 0) {
        acBox.append(`
            <div class="dnd-ac-display">
                <span class="dnd-ac-base">${eqEffects.baseAC}</span>
                <span class="dnd-ac-arrow">→</span>
                <span class="dnd-ac-total">${eqEffects.baseAC + eqEffects.acBonus}</span>
            </div>
        `);
    } else {
        acBox.append(`<div class="dnd-derived-value">${eqEffects.baseAC}</div>`);
    }
    derivedRow.append(acBox);

    // Max HP
    const hpBox = $(`
        <div class="dnd-derived-box">
            <div class="dnd-derived-label">Max HP</div>
            <input type="number" class="dnd-derived-input" data-field="maxHp" value="${member.maxHp}" min="1" />
        </div>
    `);
    hpBox.find('input').on('change', function () {
        member.maxHp = parseInt(String($(this).val()), 10) || 1;
        member.classPresetDirty = true;
    });
    derivedRow.append(hpBox);

    // Speed
    const speedBox = $(`
        <div class="dnd-derived-box">
            <div class="dnd-derived-label">Speed</div>
            <input type="number" class="dnd-derived-input" data-field="speed" value="${member.speed}" min="0" />
        </div>
    `);
    speedBox.find('input').on('change', function () {
        member.speed = parseInt(String($(this).val()), 10) || 30;
        member.classPresetDirty = true;
    });
    derivedRow.append(speedBox);

    sheet.append(derivedRow);

    // Conditions (multi-select chip-based)
    sheet.append('<div class="dnd-section-title">Conditions</div>');
    const conditionsContainer = $('<div class="dnd-conditions-chips"></div>');
    const activeConditions = member.activeConditions || [];

    for (const cond of CONDITIONS) {
        const isActive = activeConditions.includes(cond);
        const chip = $(`<div class="dnd-condition-chip ${isActive ? 'active' : ''}" data-condition="${cond}">${cond}</div>`);
        chip.on('click', function () {
            const idx = member.activeConditions.indexOf(cond);
            if (idx >= 0) {
                member.activeConditions.splice(idx, 1);
                $(this).removeClass('active');
            } else {
                member.activeConditions.push(cond);
                $(this).addClass('active');
            }
            // Also sync the legacy text field
            member.conditions = member.activeConditions.join(', ');
        });
        conditionsContainer.append(chip);
    }
    sheet.append(conditionsContainer);

    panel.append(sheet);
    return panel;
}

/**
 * @param {PartyMember} member
 * @returns {JQuery}
 */
function buildInventoryTab(member) {
    const panel = $('<div class="dnd-tab-panel" data-panel="inventory"></div>');
    const inventory = $('<div class="dnd-inventory"></div>');

    // ---- Left: Equipped Items ----
    const left = $('<div class="dnd-inventory-left"></div>');
    left.append('<div class="dnd-section-title">Equipped Items</div>');

    const equipGrid = $('<div class="dnd-equipment-grid"></div>');

    // Layout rows matching a simplified character paper doll
    const slotRows = [
        [EQUIPMENT_SLOTS.HEAD],
        [EQUIPMENT_SLOTS.WEAPON, EQUIPMENT_SLOTS.BODY, EQUIPMENT_SLOTS.SHIELD],
        [EQUIPMENT_SLOTS.HANDS, EQUIPMENT_SLOTS.RING],
        [EQUIPMENT_SLOTS.FEET],
    ];

    for (const row of slotRows) {
        const rowEl = $('<div class="dnd-equipment-row"></div>');
        for (const slotKey of row) {
            const info = SLOT_INFO[slotKey];
            const equippedItem = getEquippedItem(member, slotKey);
            const slotEl = $(`<div class="dnd-equipment-slot ${equippedItem ? 'occupied' : ''}" data-slot="${slotKey}" title="${info.label}"></div>`);

            if (equippedItem && equippedItem.image) {
                slotEl.append(`<img class="dnd-equipment-slot-img" src="${equippedItem.image}" alt="${equippedItem.name}" />`);
            } else if (equippedItem) {
                slotEl.append(`<i class="dnd-equipment-slot-icon fa-solid ${info.icon}"></i>`);
                slotEl.append(`<span style="font-size:0.6rem;color:#2dd4bf;margin-top:2px;">${equippedItem.name}</span>`);
            } else {
                slotEl.append(`<i class="dnd-equipment-slot-icon fa-solid ${info.icon}"></i>`);
            }

            slotEl.append(`<span class="dnd-equipment-slot-label">${info.label}</span>`);

            slotEl.on('click', function () {
                if (equippedItem) {
                    tryUnequip(member, slotKey);
                    rebuildInventoryPanel(panel, member);
                } else {
                    showEquipSelector(panel, member, slotKey);
                }
            });

            rowEl.append(slotEl);
        }
        equipGrid.append(rowEl);
    }

    left.append(equipGrid);
    inventory.append(left);

    // ---- Right: Currency, Stats, Carrying ----
    const right = $('<div class="dnd-inventory-right"></div>');

    // Currency
    right.append('<div class="dnd-section-title">Currency</div>');
    const currencyRow = $('<div class="dnd-currency"></div>');
    for (const [key, label] of [['gold', 'Gold Pieces'], ['silver', 'Silver Pieces'], ['copper', 'Copper Pieces']]) {
        const item = $(`
            <div class="dnd-currency-item">
                <input type="number" class="dnd-currency-value" data-currency="${key}" value="${/** @type {any} */ (member)[key] || 0}" min="0" />
                <span class="dnd-currency-label">${label}</span>
            </div>
        `);
        item.find('input').on('change', function () {
            /** @type {any} */ (member)[key] = parseInt(String($(this).val()), 10) || 0;
        });
        currencyRow.append(item);
    }
    right.append(currencyRow);

    // Stats summary
    right.append('<div class="dnd-section-title" style="margin-top:12px">Stats</div>');
    const eqEffects = applyEquipmentEffects(member);
    const statsGrid = $('<div class="dnd-inv-stats"></div>');
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    for (const ab of abilities) {
        const bonus = eqEffects.statBonuses[ab] || 0;
        const base = /** @type {any} */ (member)[ab] || 10;
        const display = bonus ? `${base} + ${bonus}` : `${base}`;
        statsGrid.append(`
            <div class="dnd-inv-stat">
                <div class="dnd-inv-stat-label">${ab.charAt(0).toUpperCase() + ab.slice(1)}</div>
                <div class="dnd-inv-stat-value">${display}</div>
            </div>
        `);
    }
    right.append(statsGrid);

    // Carrying Capacity
    const totalWeight = calculateTotalWeight(member.items || []);
    const maxCapacity = calculateCarryingCapacity(member.strength || 10);
    const pct = maxCapacity > 0 ? Math.min(100, (totalWeight / maxCapacity) * 100) : 0;

    right.append(`
        <div class="dnd-carrying">
            <div class="dnd-carrying-title">Carrying Capacity</div>
            <div class="dnd-carrying-bar-bg">
                <div class="dnd-carrying-bar-fill ${pct > 100 ? 'overweight' : ''}" style="width:${pct}%"></div>
            </div>
            <div class="dnd-carrying-text">${totalWeight.toFixed(1)}/${maxCapacity} lbs.</div>
        </div>
    `);

    inventory.append(right);
    panel.append(inventory);

    // ---- Item sub-tabs and list ----
    buildItemListSection(panel, member);

    return panel;
}

/**
 * Rebuild the inventory panel content
 * @param {JQuery} panel
 * @param {PartyMember} member
 */
function rebuildInventoryPanel(panel, member) {
    panel.empty();
    const newContent = buildInventoryTab(member);
    panel.append(newContent.children());
    panel.addClass('active');
}

/**
 * Show a simple selector popup for equipping an item to a slot
 * @param {JQuery} panel
 * @param {PartyMember} member
 * @param {string} slot
 */
function showEquipSelector(panel, member, slot) {
    // Renunciar al escudo tiene que pagar algo, o nadie renunciaria al escudo. Y se dice
    // el motivo, que es lo que convierte una regla en una decision entendida.
    if (slot === 'shield') {
        const sinMano = shieldBlocked(member);
        if (sinMano) {
            toastr.info(sinMano, 'No puedes llevar escudo');
            return;
        }
    }

    const eligibleItems = (member.items || []).filter(item => {
        if (item.slot !== slot) return false;
        // Check not already equipped
        for (const eqId of Object.values(member.equippedItems || {})) {
            if (eqId === item.id) return false;
        }
        return true;
    });

    if (eligibleItems.length === 0) {
        toastr.info(t`No items available for this slot.`);
        return;
    }

    const html = eligibleItems.map(item => `
        <div class="dnd-item-card" data-item-id="${item.id}" style="cursor:pointer;">
            ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : '<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>'}
            <div class="dnd-item-info">
                <div class="dnd-item-name">${shownName(item)}</div>
                <div class="dnd-item-meta">${item.type} · ${item.weight} lbs</div>
            </div>
        </div>
    `).join('');

    const popupEl = $(`<div style="max-width:400px"><div class="dnd-section-title">Select item for ${SLOT_INFO[slot]?.label || slot}</div><div class="dnd-item-list">${html}</div></div>`);

    const selectorPopup = new Popup(popupEl, POPUP_TYPE.TEXT, '', {
        okButton: t`Cancel`,
    });

    popupEl.find('.dnd-item-card').on('click', function () {
        const itemId = $(this).data('item-id');
        tryEquip(member, itemId, slot);
        selectorPopup.complete(0);
        rebuildInventoryPanel(panel, member);
    });

    selectorPopup.show();
}

/**
 * @param {JQuery} form
 */
function refreshPartyItemFormState(form) {
    const categoryEl = form.find('.item-category');
    const subcategoryEl = form.find('.item-subcategory');
    const slotEl = form.find('.item-slot');
    if (!categoryEl.length || !subcategoryEl.length) return;

    const category = String(categoryEl.val() || 'gear');
    const currentSubcategory = String(subcategoryEl.val() || 'generic');
    const subcategoryOptions = getItemSubcategoryOptions(category);
    subcategoryEl.html(subcategoryOptions.map(([value, label]) => `<option value="${escItemText(value)}">${escItemText(label)}</option>`).join(''));
    subcategoryEl.val(subcategoryOptions.some(([value]) => value === currentSubcategory) ? currentSubcategory : (subcategoryOptions[0]?.[0] || 'generic'));

    const subcategory = String(subcategoryEl.val() || 'generic');
    const armorDexModeEl = form.find('.item-armor-dex-mode');
    const resistanceEnabled = Boolean(form.find('.item-flag[data-flag="resistanceEnabled"]').prop('checked'));
    const isEmitsLight = Boolean(form.find('.item-emits-light').prop('checked'));
    form.find('.dnd-item-conditional').each(function () {
        /** @type {HTMLElement} */
        const element = /** @type {HTMLElement} */ (this);
        const categories = String(element.getAttribute('data-item-categories') || '').split(',').map(value => value.trim()).filter(Boolean);
        const subcategories = String(element.getAttribute('data-item-subcategories') || '').split(',').map(value => value.trim()).filter(Boolean);
        const categoryMatch = !categories.length || categories.includes(category);
        const subcategoryMatch = !subcategories.length || subcategories.includes(subcategory);
        $(element).toggle(categoryMatch && subcategoryMatch);
    });

    const suggestedSlot = getSuggestedSlotForItem(category, subcategory);
    if (subcategory === 'basic_consumable') {
        slotEl.val('');
    } else if (subcategory === 'container') {
        slotEl.val('container');
    } else if (suggestedSlot != null) {
        slotEl.val(suggestedSlot || '');
    }

    const consumableEl = form.find('.item-consumable');
    if (subcategory === 'basic_consumable') {
        consumableEl.prop('checked', true);
        consumableEl.prop('disabled', true);
    } else {
        consumableEl.prop('disabled', false);
    }

    const stackableEl = form.find('.item-flag[data-flag="stackable"]');
    const stackSizeWrap = form.find('.item-stack-size').closest('.dnd-form-row');
    if (stackSizeWrap.length) {
        const shouldShowStack = subcategory === 'basic_consumable';
        stackSizeWrap.toggle(shouldShowStack && Boolean(stackableEl.prop('checked')));
    }

    const lightFieldsWrap = form.find('.dnd-item-light-fields');
    if (lightFieldsWrap.length) {
        lightFieldsWrap.toggle(subcategory === 'exploration_tool' && isEmitsLight);
    }

    const meleeRangeEl = form.find('.item-melee-range');
    if (meleeRangeEl.length) {
        if (isMeleeWeaponSubcategory(subcategory)) {
            meleeRangeEl.prop('disabled', subcategory !== 'generic');
            if (subcategory !== 'generic') {
                meleeRangeEl.val('5');
            }
        } else {
            meleeRangeEl.prop('disabled', false);
        }
    }

    if (category === 'armor' && armorDexModeEl.length) {
        if (subcategory === 'generic') {
            armorDexModeEl.prop('disabled', false);
            if (!armorDexModeEl.val()) armorDexModeEl.val('full');
        } else {
            const implicitMode = subcategory === 'medium_armor' ? 'max_2' : (subcategory === 'heavy_armor' || subcategory === 'shield' ? 'none' : 'full');
            armorDexModeEl.val(implicitMode);
            armorDexModeEl.prop('disabled', true);
        }
    }

    const armorDexNoteEl = form.find('.dnd-armor-dex-note');
    if (armorDexNoteEl.length) {
        armorDexNoteEl.text(getArmorDexRuleLabel(subcategory, String(armorDexModeEl.val() || 'full')));
    }

    const resistanceWrap = form.find('.dnd-item-resistance-conditional');
    if (resistanceWrap.length) {
        resistanceWrap.toggle(category === 'armor' && resistanceEnabled);
    }

    // magic_weapon_armor: force Combat and Defense Stats section wrappers to show
    if (category === 'magic' && subcategory === 'magic_weapon_armor') {
        form.find('.dnd-item-conditional').each(function () {
            const el = /** @type {HTMLElement} */ (this);
            const catAttr = (el.getAttribute('data-item-categories') || '').split(',').map(s => s.trim());
            const subAttr = (el.getAttribute('data-item-subcategories') || '').split(',').map(s => s.trim()).filter(Boolean);
            if ((catAttr.includes('weapon') || catAttr.includes('armor')) && subAttr.length === 0) {
                $(el).show();
            }
        });
    }

    // Auto-consumable for potion_oil and scroll: check and lock the consumable checkbox
    if (category === 'magic') {
        const magicFlags = getMagicSubtypeFlags(subcategory);
        if (magicFlags.autoConsumable) {
            consumableEl.prop('checked', true);
            consumableEl.prop('disabled', true);
        } else {
            consumableEl.prop('disabled', false);
        }
    }
}

/**
 * Build the item list section with sub-tabs, search, and add button
 * @param {JQuery} panel
 * @param {PartyMember} member
 */
function buildItemListSection(panel, member) {
    const section = $('<div style="margin-top: 16px;"></div>');

    // Sub-tabs
    const itemTabs = $('<div class="dnd-item-tabs"></div>');
    const tabDefs = [
        { key: 'all', label: 'All', icon: 'fa-table-cells' },
        { key: 'weapon', label: 'Weapons', icon: 'fa-sword' },
        { key: 'armor', label: 'Armor', icon: 'fa-shield-halved' },
        { key: 'gear', label: 'Gear', icon: 'fa-toolbox' },
    ];

    for (const td of tabDefs) {
        itemTabs.append(`<div class="dnd-item-tab ${td.key === 'all' ? 'active' : ''}" data-filter="${td.key}"><i class="fa-solid ${td.icon}"></i> ${td.label}</div>`);
    }
    section.append(itemTabs);

    // Search + Add
    section.append(`
        <div class="dnd-item-search-row">
            <input type="text" class="dnd-item-search" placeholder="Search..." />
            <button class="dnd-add-item-btn"><i class="fa-solid fa-plus"></i> Add Item</button>
        </div>
    `);

    // Item list container
    const listContainer = $('<div class="dnd-item-list"></div>');
    section.append(listContainer);

    /** Render items with filter and search */
    function renderItems(filter = 'all', search = '') {
        listContainer.empty();
        let items = filter === 'all' ? [...(member.items || [])].map(normalizeItem) : getItemsByType(member, /** @type {'weapon'|'armor'|'gear'} */ (filter));
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(i => i.name.toLowerCase().includes(q));
        }

        if (items.length === 0) {
            listContainer.append('<div class="dnd-empty-state">No items found.</div>');
            return;
        }

        for (const item of items) {
            const isEquipped = Object.values(member.equippedItems || {}).includes(item.id);
            const isEquippableSlot = Boolean(item.slot && Object.values(EQUIPMENT_SLOTS).includes(item.slot));
            const canUseConsumable = item.consumable && ((item.uses ?? 1) > 0);
            // Idea 135: de lo que no se ha identificado no se sabe lo que hace.
            const effectsText = /** @type {any} */ (item).identified === false ? '' : (item.effects || []).map(/** @param {import('../dnd-system.js').DndItemEffect} e */ e => `${e.stat} ${e.modifier >= 0 ? '+' : ''}${e.modifier}`).join(', ');
            const metaText = buildItemMetaSummary(item).join(' · ');
            const card = $(`
                <div class="dnd-item-card ${isEquipped ? 'equipped' : ''}" data-item-id="${item.id}">
                    ${item.image ? `<img class="dnd-item-img" src="${item.image}" />` : '<div class="dnd-item-img-placeholder"><i class="fa-solid fa-box"></i></div>'}
                    <div class="dnd-item-info">
                        <div class="dnd-item-name">${shownName(item)}${isEquipped ? ' <span style="color:#2dd4bf;font-size:0.7rem;">(equipped)</span>' : ''}</div>
                        <div class="dnd-item-meta">${metaText}${effectsText ? ' · ' + effectsText : ''}</div>
                    </div>
                    <div class="dnd-item-actions">
                        ${isEquipped
        ? '<button class="dnd-item-action-btn unequip-btn" title="Unequip"><i class="fa-solid fa-arrow-down"></i></button>'
        : (isEquippableSlot ? '<button class="dnd-item-action-btn equip-btn" title="Equip"><i class="fa-solid fa-arrow-up"></i></button>' : '')}
                        ${canUseConsumable ? '<button class="dnd-item-action-btn use-btn" title="Use"><i class="fa-solid fa-vial"></i></button>' : ''}
                        <button class="dnd-item-action-btn delete" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `);

            card.find('.equip-btn').on('click', function (e) {
                e.stopPropagation();
                if (item.slot) tryEquip(member, item.id, item.slot);
                rebuildInventoryPanel(panel, member);
            });

            card.find('.unequip-btn').on('click', function (e) {
                e.stopPropagation();
                const slot = Object.entries(member.equippedItems || {}).find(([, v]) => v === item.id)?.[0];
                if (slot) tryUnequip(member, slot);
                rebuildInventoryPanel(panel, member);
            });

            card.find('.delete').on('click', function (e) {
                e.stopPropagation();
                removeItemFromInventory(member, item.id);
                renderItems(filter, search);
                rebuildInventoryPanel(panel, member);
            });

            card.find('.use-btn').on('click', function (e) {
                e.stopPropagation();
                const useResult = consumeItemInInventory(member, item.id);
                if (!useResult.consumed) {
                    toastr.info(t`This item cannot be consumed.`);
                    return;
                }

                if (useResult.removed) {
                    toastr.success(t`Item consumed and removed.`);
                } else {
                    toastr.success(t`Item consumed. Remaining uses updated.`);
                }

                renderItems(filter, search);
                rebuildInventoryPanel(panel, member);
            });

            listContainer.append(card);
        }
    }

    renderItems();

    // Tab switching
    section.find('.dnd-item-tab').on('click', function () {
        section.find('.dnd-item-tab').removeClass('active');
        $(this).addClass('active');
        const filter = String($(this).data('filter'));
        const search = String(section.find('.dnd-item-search').val() || '');
        renderItems(filter, search);
    });

    // Search
    section.find('.dnd-item-search').on('input', function () {
        const activeFilter = String(section.find('.dnd-item-tab.active').data('filter') || 'all');
        renderItems(activeFilter, String($(this).val() || ''));
    });

    // Add item button
    section.find('.dnd-add-item-btn').on('click', function () {
        openAddItemForm(panel, member);
    });

    panel.append(section);
}

/**
 * Open a popup form to add a new item
 * @param {JQuery} panel - The inventory panel for refresh
 * @param {PartyMember} member
 */
async function openAddItemForm(panel, member) {
    const defaultItem = normalizeItem({});
    const categoryOptions = getItemCategoryOptions();
    const slotOptions = [['', 'None (unequippable)'], ['container', 'Container'], ...Object.entries(SLOT_INFO).map(([key, info]) => [key, info.label])];
    const subcategoryOptions = getItemSubcategoryOptions(defaultItem.category || 'gear');
    const form = $(`
        <div class="dnd-add-item-form" style="min-width:380px;">
            <div class="dnd-form-row"><label>Name</label><input type="text" class="item-name" value="" /></div>
            <div class="dnd-form-row">
                <label>Category</label>
                <select class="item-category">
                    ${categoryOptions.map(([value, label]) => `<option value="${escItemText(value)}" ${value === defaultItem.category ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Subcategory</label>
                <select class="item-subcategory">
                    ${subcategoryOptions.map(([value, label]) => `<option value="${escItemText(value)}" ${value === defaultItem.subcategory ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Slot</label>
                <select class="item-slot">
                    ${slotOptions.map(([value, label]) => `<option value="${escItemText(value)}" ${value === (defaultItem.slot || '') ? 'selected' : ''}>${escItemText(label)}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row"><label>Image URL</label><input type="text" class="item-image" placeholder="Optional image URL" /></div>
            <div class="dnd-form-row"><label>Weight</label><input type="number" class="item-weight" value="0" min="0" step="0.1" /></div>
            ${buildPartyItemSections(defaultItem)}
            <div class="dnd-form-row"><label>Description</label><textarea class="item-desc" placeholder="Item description..."></textarea></div>
            <div style="margin-top:8px;">
                <label style="font-size:0.8rem;font-weight:600;color:var(--SmartThemeEmColor);">Effects</label>
                <div class="dnd-effect-rows"></div>
                <button class="dnd-add-effect-btn"><i class="fa-solid fa-plus"></i> Add Effect</button>
            </div>
        </div>
    `);

    // Add effect button
    form.find('.dnd-add-effect-btn').on('click', function () {
        const row = $(`
            <div class="dnd-effect-row">
                <select class="effect-stat">
                    ${MODIFIABLE_STATS.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <input type="number" class="effect-modifier" value="0" />
                <button class="dnd-remove-effect-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `);
        row.find('.dnd-remove-effect-btn').on('click', function () { row.remove(); });
        form.find('.dnd-effect-rows').append(row);
    });

    refreshPartyItemFormState(form);
    form.find('.item-category, .item-subcategory, .item-armor-dex-mode, .item-flag[data-flag="resistanceEnabled"], .item-emits-light, .item-flag[data-flag="stackable"]').on('change', function () {
        refreshPartyItemFormState(form);
    });

    const popup = new Popup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: t`Add Item`,
        cancelButton: t`Cancel`,
    });

    const result = await popup.show();
    if (result !== 1) return; // POPUP_RESULT.AFFIRMATIVE

    /** @type {import('../dnd-system.js').DndItemEffect[]} */
    const effects = [];
    form.find('.dnd-effect-row').each(function () {
        effects.push({
            stat: String($(this).find('.effect-stat').val() || 'armorClass'),
            modifier: parseInt(String($(this).find('.effect-modifier').val()), 10) || 0,
        });
    });

    const resistanceTypes = form.find('.item-resistance:checked').map(function () {
        return String($(this).data('value') || '');
    }).get().filter(Boolean);

    const selectedSubcategory = String(form.find('.item-subcategory').val() || 'generic');
    if (selectedSubcategory === 'container') {
        const capacityWeight = parseInt(String(form.find('.item-capacity-weight').val() || ''), 10) || 0;
        const capacityVolume = parseFloat(String(form.find('.item-capacity-volume').val() || '')) || 0;
        if (capacityWeight <= 0 || capacityVolume <= 0) {
            toastr.error(t`Container items require Capacity Weight and Capacity Volume greater than 0.`);
            return;
        }
    }

    const newItem = createItem({
        name: form.find('.item-name').val()?.toString().trim() || 'New Item',
        category: /** @type {'weapon'|'armor'|'gear'|'magic'|'mount_vehicle_trade'} */ (String(form.find('.item-category').val() || 'gear')),
        subcategory: String(form.find('.item-subcategory').val() || 'generic'),
        slot: String(form.find('.item-slot').val() || '') || null,
        image: form.find('.item-image').val()?.toString().trim() || '',
        weight: parseFloat(String(form.find('.item-weight').val())) || 0,
        description: form.find('.item-desc').val()?.toString().trim() || '',
        rarity: form.find('.item-rarity').val()?.toString().trim() || '',
        damageDice: form.find('.item-damage-dice').val()?.toString().trim() || '',
        baseDamage: form.find('.item-damage-dice').val()?.toString().trim() || '',
        damageType: form.find('.item-damage-type').val()?.toString().trim() || '',
        properties: form.find('.item-properties').val()?.toString().trim() || '',
        meleeRange: parseInt(String(form.find('.item-melee-range').val() || ''), 10) || 5,
        range: parseInt(String(form.find('.item-range').val() || ''), 10) || null,
        longRange: parseInt(String(form.find('.item-long-range').val() || ''), 10) || null,
        versatileDamage: form.find('.item-versatile-damage').val()?.toString().trim() || '',
        baseArmorClass: parseInt(String(form.find('.item-base-armor-class').val() || ''), 10) || null,
        armorClass: parseInt(String(form.find('.item-base-armor-class').val() || ''), 10) || null,
        armorDexMode: /** @type {'full'|'max_2'|'none'} */ (String(form.find('.item-armor-dex-mode').val() || 'full')),
        strengthRequirement: parseInt(String(form.find('.item-strength-req').val() || ''), 10) || null,
        donTime: form.find('.item-don-time').val()?.toString().trim() || '',
        doffTime: form.find('.item-doff-time').val()?.toString().trim() || '',
        consumable: Boolean(form.find('.item-consumable').prop('checked')),
        focusType: form.find('.item-focus-type').val()?.toString().trim() || '',
        toolType: form.find('.item-tool-type').val()?.toString().trim() || '',
        linkedAbility: form.find('.item-linked-ability').val()?.toString().trim() || '',
        capacity: parseInt(String(form.find('.item-capacity').val() || ''), 10) || null,
        capacityUnit: form.find('.item-capacity-unit').val()?.toString().trim() || '',
        capacityWeight: parseInt(String(form.find('.item-capacity-weight').val() || ''), 10) || null,
        capacityVolume: parseFloat(String(form.find('.item-capacity-volume').val() || '')) || null,
        stackSize: parseInt(String(form.find('.item-stack-size').val() || ''), 10) || null,
        emitsLight: Boolean(form.find('.item-emits-light').prop('checked')),
        lightBright: parseInt(String(form.find('.item-light-bright').val() || ''), 10) || null,
        lightDim: parseInt(String(form.find('.item-light-dim').val() || ''), 10) || null,
        containerItemId: form.find('.item-container-id').val()?.toString().trim() || '',
        costGp: parseInt(String(form.find('.item-cost-gp').val() || ''), 10) || null,
        attunement: Boolean(form.find('.item-attunement').prop('checked')),
        magical: Boolean(form.find('.item-magical').prop('checked')),
        cursed: Boolean(form.find('.item-cursed').prop('checked')),
        magicalBonus: parseInt(String(form.find('.item-magical-bonus').val() || ''), 10) || null,
        uses: parseInt(String(form.find('.item-uses').val() || ''), 10) || null,
        maxUses: parseInt(String(form.find('.item-max-uses').val() || ''), 10) || null,
        recharge: form.find('.item-recharge').val()?.toString().trim() || '',
        vehicleCrew: parseInt(String(form.find('.item-vehicle-crew').val() || ''), 10) || null,
        vehicleDamageThreshold: parseInt(String(form.find('.item-vehicle-threshold').val() || ''), 10) || null,
        stealthDisadvantage: Boolean(form.find('.item-flag[data-flag="stealthDisadvantage"]').prop('checked')),
        adamantine: Boolean(form.find('.item-flag[data-flag="adamantine"]').prop('checked')),
        mithral: Boolean(form.find('.item-flag[data-flag="mithral"]').prop('checked')),
        resistanceEnabled: Boolean(form.find('.item-flag[data-flag="resistanceEnabled"]').prop('checked')),
        resistanceTypes,
        finesse: Boolean(form.find('.item-flag[data-flag="finesse"]').prop('checked')),
        heavy: Boolean(form.find('.item-flag[data-flag="heavy"]').prop('checked')),
        light: Boolean(form.find('.item-flag[data-flag="light"]').prop('checked')),
        reach: Boolean(form.find('.item-flag[data-flag="reach"]').prop('checked')),
        thrown: Boolean(form.find('.item-flag[data-flag="thrown"]').prop('checked')),
        twoHanded: Boolean(form.find('.item-flag[data-flag="twoHanded"]').prop('checked')),
        versatile: Boolean(form.find('.item-flag[data-flag="versatile"]').prop('checked')),
        ammunition: Boolean(form.find('.item-flag[data-flag="ammunition"]').prop('checked')),
        loading: Boolean(form.find('.item-flag[data-flag="loading"]').prop('checked')),
        stackable: Boolean(form.find('.item-flag[data-flag="stackable"]').prop('checked')),
        toolProficiency: Boolean(form.find('.item-flag[data-flag="toolProficiency"]').prop('checked')),
        linkedSpell: form.find('.item-linked-spell').val()?.toString().trim() || '',
        spellLevel: parseInt(String(form.find('.item-spell-level').val() || ''), 10) || null,
        saveDC: parseInt(String(form.find('.item-save-dc').val() || ''), 10) || null,
        spellAttackBonus: parseInt(String(form.find('.item-spell-attack').val() || ''), 10) || null,
        storageWeightLimit: parseInt(String(form.find('.item-storage-weight').val() || ''), 10) || null,
        storageVolumeLimit: parseInt(String(form.find('.item-storage-volume').val() || ''), 10) || null,
        brightLightRadius: parseInt(String(form.find('.item-bright-light').val() || ''), 10) || null,
        dimLightRadius: parseInt(String(form.find('.item-dim-light').val() || ''), 10) || null,
        effects,
    });

    addItemToInventory(member, newItem);
    rebuildInventoryPanel(panel, member);
}

/**
 * @param {PartyMember} member
 * @param {DndCatalog} dndCatalog
 * @returns {JQuery}
 */
function buildProgressionTab(member, dndCatalog) {
    const panel = $('<div class="dnd-tab-panel" data-panel="progression"></div>');
    const prog = $('<div class="dnd-progression"></div>');

    // Level
    prog.append(`
        <div class="dnd-level-display">
            <div class="dnd-level-number">${member.level}</div>
            <div class="dnd-level-label">Level</div>
        </div>
    `);

    // Class
    const classOptions = Array.from(new Set([...(dndCatalog.classes || []), String(member.class || '').trim()].filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const classEdit = $(`
        <div class="dnd-class-edit">
            <label style="font-size:0.8rem;color:var(--SmartThemeTextColor);">Class:</label>
            <select class="dnd-class-input text_pole"></select>
        </div>
    `);
    const classSelect = classEdit.find('select');
    classSelect.append('<option value="">Adventurer</option>');
    for (const className of classOptions) {
        classSelect.append(`<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`);
    }
    classSelect.val(member.class || '');
    classSelect.on('change', async function () {
        const selectedClass = String($(this).val() || '').trim() || 'Adventurer';
        if (selectedClass === member.class) return;

        const nextPreset = dndCatalog.classPresets.get(selectedClass);
        if (nextPreset) {
            if (memberHasLikelyEditedStats(member)) {
                const overwritePopup = new Popup(
                    `${t`This character has manually edited stats.`}<br>${t`Apply the class preset and overwrite current stats?`}`,
                    POPUP_TYPE.CONFIRM,
                    '',
                    { okButton: t`Apply Preset`, cancelButton: t`Keep Current Stats` },
                );
                const result = await overwritePopup.show();
                if (result !== POPUP_RESULT.AFFIRMATIVE) {
                    classSelect.val(member.class || '');
                    return;
                }
            }

            member.class = selectedClass;
            applyClassPresetToMember(member, nextPreset);
        } else {
            member.class = selectedClass;
        }
    });
    prog.append(classEdit);

    // HP bar
    const hpPct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
    prog.append(`
        <div class="dnd-hp-section">
            <div class="dnd-section-title">Hit Points</div>
            <div class="dnd-hp-bar-bg">
                <div class="dnd-hp-bar-fill" style="width:${hpPct}%"></div>
                <div class="dnd-hp-bar-text">${member.hp} / ${member.maxHp}</div>
            </div>
            <div class="dnd-xp-inputs">
                <div class="dnd-xp-field">
                    <label>Current HP</label>
                    <input type="number" class="hp-current-input" value="${member.hp}" min="0" />
                </div>
                <div class="dnd-xp-field">
                    <label>Max HP</label>
                    <input type="number" class="hp-max-input" value="${member.maxHp}" min="1" />
                </div>
            </div>
        </div>
    `);

    prog.find('.hp-current-input').on('change', function () {
        member.hp = parseInt(String($(this).val()), 10) || 0;
        member.classPresetDirty = true;
        const pct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
        prog.find('.dnd-hp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-hp-bar-text').text(`${member.hp} / ${member.maxHp}`);
    });

    prog.find('.hp-max-input').on('change', function () {
        member.maxHp = parseInt(String($(this).val()), 10) || 1;
        member.classPresetDirty = true;
        const pct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
        prog.find('.dnd-hp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-hp-bar-text').text(`${member.hp} / ${member.maxHp}`);
    });

    // XP bar
    const xpPct = member.xpNext > 0 ? Math.min(100, (member.xp / member.xpNext) * 100) : 0;
    prog.append(`
        <div class="dnd-xp-section">
            <div class="dnd-section-title">Experience Points</div>
            <div class="dnd-xp-bar-bg">
                <div class="dnd-xp-bar-fill" style="width:${xpPct}%"></div>
                <div class="dnd-xp-bar-text">${member.xp} / ${member.xpNext} (${Math.round(xpPct)}%)</div>
            </div>
            <div class="dnd-xp-inputs">
                <div class="dnd-xp-field">
                    <label>Current XP</label>
                    <input type="number" class="xp-current-input" value="${member.xp}" min="0" />
                </div>
                <div class="dnd-xp-field">
                    <label>XP to Next Level</label>
                    <input type="number" class="xp-next-input" value="${member.xpNext}" min="1" />
                </div>
            </div>
        </div>
    `);

    prog.find('.xp-current-input').on('change', function () {
        member.xp = parseInt(String($(this).val()), 10) || 0;
        const pct = member.xpNext > 0 ? Math.min(100, (member.xp / member.xpNext) * 100) : 0;
        prog.find('.dnd-xp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-xp-bar-text').text(`${member.xp} / ${member.xpNext} (${Math.round(pct)}%)`);
        updateLevelUpButton();
    });

    prog.find('.xp-next-input').on('change', function () {
        member.xpNext = parseInt(String($(this).val()), 10) || 100;
        const pct = member.xpNext > 0 ? Math.min(100, (member.xp / member.xpNext) * 100) : 0;
        prog.find('.dnd-xp-bar-fill').css('width', pct + '%');
        prog.find('.dnd-xp-bar-text').text(`${member.xp} / ${member.xpNext} (${Math.round(pct)}%)`);
        updateLevelUpButton();
    });

    // Subir de nivel: el mismo camino que el boton de la ficha de companero, porque dos
    // formas de subir de nivel son dos sitios donde olvidarse de dar los PG.
    const levelUpBtn = $(`<button class="dnd-level-up-btn" ${canLevelUp(member) ? '' : 'disabled'}><i class="fa-solid fa-arrow-up"></i> Subir de nivel</button>`);
    levelUpBtn.on('click', function () {
        void openLevelUpCard(member);
    });
    prog.append(levelUpBtn);

    function updateLevelUpButton() {
        levelUpBtn.prop('disabled', !canLevelUp(member));
    }

    panel.append(prog);
    return panel;
}

/**
 * @param {any} rel
 * @returns {'normal'|'amoroso'|'familiar'}
 */
function getRelationshipCategory(rel) {
    const explicitCategory = String(rel?.category || '').trim();
    if (RELATIONSHIP_CATEGORIES.includes(explicitCategory)) {
        return /** @type {'normal'|'amoroso'|'familiar'} */ (explicitCategory);
    }

    const legacyType = String(rel?.type || '').trim();
    if (legacyType === 'romantic') return 'amoroso';
    if (legacyType === 'family') return 'familiar';
    return 'normal';
}

/**
 * @param {'normal'|'amoroso'|'familiar'} category
 * @returns {string}
 */
function getRelationshipCategoryLabel(category) {
    if (category === 'amoroso') return 'amoroso';
    if (category === 'familiar') return 'familiar';
    return 'normal';
}

/**
 * @param {number} score
 * @returns {string}
 */
function getNormalRelationshipBand(score) {
    if (score >= 100) return 'mejor amigo';
    if (score >= 50) return 'amistad';
    if (score <= -100) return 'archienemigo';
    if (score <= -50) return 'enemigo';
    return 'indiferente';
}

/**
 * @param {{ category?: string, score?: number, type?: string }} rel
 * @returns {string}
 */
function getRelationshipSummary(rel) {
    const category = getRelationshipCategory(rel);
    const score = clampRelationshipScore(rel?.score ?? 0);
    if (category === 'normal') return getNormalRelationshipBand(score);
    if (category === 'amoroso') return 'amoroso';
    return 'familiar';
}

/**
 * Returns selectable character names from the specific lorebook tied to this member.
 * Prefers member.worldName; falls back to active chat world.
 * @param {PartyMember} member
 * @returns {Promise<string[]>}
 */
async function getRelationshipTargetNamesFromLorebook(member) {
    const worldName = String(member.worldName || chat_metadata?.[METADATA_KEY] || '').trim();
    if (!worldName) return [];

    try {
        const data = /** @type {any} */ (await loadWorldInfo(worldName));
        if (!data?.entries) return [];

        const names = [];
        for (const uid of Object.keys(data.entries)) {
            const entry = data.entries[uid];
            const group = String(entry?.group || '').trim().toLowerCase();
            if (!group.includes('character')) continue;

            const name = getPartyEntryDisplayName(entry).trim();
            if (!name) continue;
            names.push(name);
        }

        return [...new Set(names)];
    } catch (error) {
        console.warn('Could not load lorebook characters for relationship picker', { worldName, error });
        return [];
    }
}

/**
 * @param {PartyMember} member
 * @returns {JQuery}
 */
function buildRelationshipsTab(member) {
    const panel = $('<div class="dnd-tab-panel" data-panel="relationships"></div>');
    const container = $('<div class="dnd-relationships"></div>');

    // Actions
    const actions = $('<div class="dnd-relationships-actions"></div>');
    const analyzeBtn = $('<button class="dnd-rel-btn"><i class="fa-solid fa-magnifying-glass"></i> Analyze Chat</button>');
    const addBtn = $('<button class="dnd-rel-btn"><i class="fa-solid fa-plus"></i> Add Relationship</button>');
    actions.append(analyzeBtn, addBtn);
    container.append(actions);

    // List
    const list = $('<div class="dnd-relationship-list"></div>');
    container.append(list);

    function renderRelationships() {
        list.empty();
        if (!member.relationships || member.relationships.length === 0) {
            list.append('<div class="dnd-empty-state">No relationships defined yet.</div>');
            return;
        }

        for (let i = 0; i < member.relationships.length; i++) {
            const rel = member.relationships[i];
            const category = getRelationshipCategory(rel);
            const score = clampRelationshipScore(rel?.score ?? 0);
            const scoreText = `${score >= 0 ? '+' : ''}${score}`;
            const summaryText = getRelationshipSummary(rel);
            const card = $(`
                <div class="dnd-relationship-card">
                    <div class="dnd-rel-avatar" style="display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-user" style="font-size:1.2rem;"></i></div>
                    <div class="dnd-rel-info">
                        <div class="dnd-rel-name">${rel.characterName}</div>
                        <div class="dnd-rel-meta">
                            <span class="dnd-rel-summary">${summaryText}</span>
                            <span class="dnd-rel-score">${scoreText}</span>
                        </div>
                    </div>
                    <span class="dnd-rel-category-badge ${category}">${getRelationshipCategoryLabel(category)}</span>
                    <div class="dnd-rel-actions">
                        <button class="dnd-rel-action-btn edit-rel" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="dnd-rel-action-btn delete" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `);

            card.find('.delete').on('click', function () {
                member.relationships.splice(i, 1);
                renderRelationships();
            });

            card.find('.edit-rel').on('click', function () {
                openRelationshipEditor(member, i, renderRelationships);
            });

            list.append(card);
        }
    }

    renderRelationships();

    // Analyze chat button
    analyzeBtn.on('click', function () {
        const messages = chat || [];
        const otherNames = partyMembers.map(m => m.name).filter(n => n !== member.name);
        const suggestions = analyzeRelationshipsFromChat(/** @type {any} */ (messages), member.name, otherNames);

        if (suggestions.length === 0) {
            toastr.info(t`No relationship patterns found in chat.`);
            return;
        }

        // Add suggestions that don't exist yet
        let added = 0;
        for (const sug of suggestions) {
            const exists = (member.relationships || []).some(r =>
                r.characterName.toLowerCase() === sug.characterName.toLowerCase(),
            );
            if (!exists) {
                member.relationships = member.relationships || [];
                member.relationships.push(sug);
                added++;
            }
        }

        if (added > 0) {
            toastr.success(`Found ${added} new relationship(s) from chat.`);
            renderRelationships();
        } else {
            toastr.info(t`No new relationships found.`);
        }
    });

    // Add relationship button
    addBtn.on('click', function () {
        openRelationshipEditor(member, -1, renderRelationships);
    });

    panel.append(container);
    return panel;
}

/**
 * Open editor for a relationship (new or existing)
 * @param {PartyMember} member
 * @param {number} index - -1 for new
 * @param {Function} onSave - callback to refresh
 */
async function openRelationshipEditor(member, index, onSave) {
    const isNew = index < 0;
    const rel = isNew
        ? { characterName: '', characterAvatar: '', category: 'normal', score: 0, lastInteraction: '', type: '', description: '' }
        : member.relationships[index];

    const currentTargetName = String(rel?.characterName || '').trim();
    const existingTargets = new Set(
        (member.relationships || [])
            .map((entry, entryIndex) => entryIndex === index ? '' : String(entry?.characterName || '').trim().toLowerCase())
            .filter(Boolean),
    );
    const lorebookCharacterNames = await getRelationshipTargetNamesFromLorebook(member);
    const validTargetNames = [...new Set(
        lorebookCharacterNames
            .filter(Boolean)
            .filter(name => name.toLowerCase() !== String(member.name || '').trim().toLowerCase())
            .filter(name => !existingTargets.has(name.toLowerCase()) || name.toLowerCase() === currentTargetName.toLowerCase()),
    )];

    if (isNew && validTargetNames.length === 0) {
        toastr.info(t`No available characters to relate.`);
        return;
    }

    const initialCategory = getRelationshipCategory(rel);
    const initialScore = clampRelationshipScore(rel?.score ?? 0);

    const form = $(`
        <div class="dnd-add-item-form" style="min-width:350px;">
            <div class="dnd-form-row">
                <label>Name</label>
                <select class="rel-name">
                    ${validTargetNames.map(name => `<option value="${name}" ${name === currentTargetName ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Category</label>
                <select class="rel-category">
                    ${RELATIONSHIP_CATEGORIES.map(category => `<option value="${category}" ${category === initialCategory ? 'selected' : ''}>${category}</option>`).join('')}
                </select>
            </div>
            <div class="dnd-form-row">
                <label>Score (${RELATIONSHIP_SCORE_MIN} to ${RELATIONSHIP_SCORE_MAX})</label>
                <input type="number" class="rel-score" min="${RELATIONSHIP_SCORE_MIN}" max="${RELATIONSHIP_SCORE_MAX}" value="${initialScore}" />
            </div>
        </div>
    `);

    const popup = new Popup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: isNew ? t`Add` : t`Save`,
        cancelButton: t`Cancel`,
    });

    const result = await popup.show();
    if (result !== 1) return;

    const selectedName = String(form.find('.rel-name').val() || '').trim();
    const selectedCategory = /** @type {'normal'|'amoroso'|'familiar'} */ (String(form.find('.rel-category').val() || 'normal'));
    const selectedScore = clampRelationshipScore(form.find('.rel-score').val());

    if (!selectedName) {
        toastr.error(t`Please select a character.`);
        return;
    }

    const duplicateExists = (member.relationships || []).some((entry, entryIndex) => {
        if (entryIndex === index) return false;
        return String(entry?.characterName || '').trim().toLowerCase() === selectedName.toLowerCase();
    });
    if (duplicateExists) {
        toastr.error(t`Relationship already exists with this character.`);
        return;
    }

    if (selectedCategory === 'amoroso' && selectedScore < 50) {
        toastr.error(t`Amoroso relationship requires score 50 or higher.`);
        return;
    }

    const updated = {
        characterName: selectedName,
        characterAvatar: rel.characterAvatar || '',
        category: selectedCategory,
        score: selectedScore,
        description: rel.description || undefined,
        lastInteraction: rel.lastInteraction || '',
    };

    if (isNew) {
        member.relationships = member.relationships || [];
        member.relationships.push(updated);
    } else {
        member.relationships[index] = updated;
    }

    onSave();
}

/**
 * @param {PartyMember} member
 * @returns {JQuery}
 */
function buildMemoriesTab(member) {
    const panel = $('<div class="dnd-tab-panel" data-panel="memories"></div>');
    const container = $('<div class="dnd-memories"></div>');

    // Actions
    const actions = $('<div class="dnd-memories-actions"></div>');
    const addBtn = $('<button class="dnd-mem-btn"><i class="fa-solid fa-plus"></i> Add Memory</button>');
    actions.append(addBtn);
    container.append(actions);

    // List
    const list = $('<div class="dnd-memory-list"></div>');
    container.append(list);

    function renderMemories() {
        list.empty();
        if (!member.memories || member.memories.length === 0) {
            list.append('<div class="dnd-empty-state">No memories recorded yet.</div>');
            return;
        }

        // Sort by date descending
        const sorted = [...member.memories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const mem of sorted) {
            const tags = (mem.tags || []).map(t => `<span class="dnd-memory-tag">${t}</span>`).join('');
            const wiBadge = mem.worldInfoBook ? `<span class="dnd-memory-wi-badge" title="Linked to World Info: ${mem.worldInfoBook}">WI: ${mem.worldInfoBook}</span>` : '';

            const card = $(`
                <div class="dnd-memory-card" data-mem-id="${mem.id}">
                    <div class="dnd-memory-header">
                        <span class="dnd-memory-date">${mem.date || 'Unknown date'}</span>
                        <div class="dnd-memory-tags">${tags}${wiBadge}</div>
                    </div>
                    <div class="dnd-memory-text">${mem.text}</div>
                    <div class="dnd-memory-actions">
                        <button class="dnd-rel-action-btn edit-mem" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="dnd-rel-action-btn delete" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `);

            card.find('.delete').on('click', function () {
                member.memories = member.memories.filter(m => m.id !== mem.id);
                renderMemories();
            });

            card.find('.edit-mem').on('click', function () {
                openMemoryEditor(member, mem.id, renderMemories);
            });

            list.append(card);
        }
    }

    renderMemories();

    addBtn.on('click', function () {
        openMemoryEditor(member, null, renderMemories);
    });

    panel.append(container);
    return panel;
}

/**
 * Open editor for a memory (new or existing)
 * @param {PartyMember} member
 * @param {string|null} memId - null for new
 * @param {Function} onSave
 */
async function openMemoryEditor(member, memId, onSave) {
    const isNew = !memId;
    const mem = isNew ? { id: '', text: '', date: new Date().toISOString().slice(0, 10), worldInfoEntryId: '', worldInfoBook: '', tags: [] } : member.memories.find(m => m.id === memId);
    if (!mem) return;

    const form = $(`
        <div class="dnd-add-item-form" style="min-width:380px;">
            <div class="dnd-form-row"><label>Date</label><input type="date" class="mem-date" value="${mem.date || new Date().toISOString().slice(0, 10)}" /></div>
            <div class="dnd-form-row"><label>Text</label><textarea class="mem-text" rows="4">${mem.text || ''}</textarea></div>
            <div class="dnd-form-row"><label>Tags</label><input type="text" class="mem-tags" value="${(mem.tags || []).join(', ')}" placeholder="Comma-separated tags" /></div>
            <div class="dnd-form-row"><label>WI Book</label><input type="text" class="mem-wi-book" value="${mem.worldInfoBook || ''}" placeholder="World Info book name (optional)" /></div>
            <div class="dnd-form-row"><label>WI Entry ID</label><input type="text" class="mem-wi-entry" value="${mem.worldInfoEntryId || ''}" placeholder="World Info entry ID (optional)" /></div>
        </div>
    `);

    const popup = new Popup(form, POPUP_TYPE.CONFIRM, '', {
        okButton: isNew ? t`Add Memory` : t`Save`,
        cancelButton: t`Cancel`,
    });

    const result = await popup.show();
    if (result !== 1) return;

    const updated = {
        id: mem.id || generateMemoryId(),
        text: form.find('.mem-text').val()?.toString().trim() || '',
        date: form.find('.mem-date').val()?.toString() || new Date().toISOString().slice(0, 10),
        worldInfoEntryId: form.find('.mem-wi-entry').val()?.toString().trim() || '',
        worldInfoBook: form.find('.mem-wi-book').val()?.toString().trim() || '',
        tags: form.find('.mem-tags').val()?.toString().split(',').map(t => t.trim()).filter(Boolean) || [],
    };

    if (isNew) {
        member.memories = member.memories || [];
        member.memories.push(updated);
    } else {
        const idx = member.memories.findIndex(m => m.id === memId);
        if (idx !== -1) member.memories[idx] = updated;
    }

    onSave();
}
