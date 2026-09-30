/**
 * El grupo: guardarlo y cargarlo con el chat, hacerlo con las fichas del mundo, pintarlo,
 * añadir y quitar, llevarlo a otra partida y la bolsa común.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { power_user } from '../power-user.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from '../popup.js';
import { getThumbnailUrl, chat_metadata, saveMetadata, setUserName, getCurrentChatId } from '../../script.js';
import { loadWorldInfo, METADATA_KEY } from '../world-info.js';
import { getDefaultDndData, migratePartyMember, createItem, normalizeDndEntityType } from '../dnd-system.js';
import { escapeHtml } from '../utils.js';
import { resolveEntryMapPosition } from './positions.js';
import { settleCarried, hubRoster } from '../game-engine/campaign/hub.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { currentLocationName, partyMembers, setPartyMembers } from './state.js';
import { openPartyMemberModal } from './sheet.js';
import { loadCombatState } from './combat-state.js';
import { getActiveBoardContext, placePartyAtStart } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { loadCurrentLocation } from './world.js';
import { packPeople, unpackPeople } from './social.js';
import { packFormation, unpackFormation } from './companions.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */
/** @typedef {import('./types.js').DndCatalog} DndCatalog */

export function savePartyState() {
    // chat_metadata.party is the single source of truth. The party used to be
    // mirrored into localStorage as well, which is global to the browser: two
    // chats open in different tabs overwrote each other, and on startup the
    // party of whichever campaign was touched last leaked into the new one.
    savePartyToMetadata();
}

/**
 * Saves current partyMembers to chat_metadata.party and persists to disk.
 */
async function savePartyToMetadata() {
    if (!chat_metadata || typeof chat_metadata !== 'object') {
        console.log('savePartyToMetadata skipped: chat_metadata invalid', { chat_metadata });
        return;
    }
    if (partyMembers.length > 0 && chat_metadata.persona) {
        console.log('Clearing locked chat persona because active party exists', { persona: chat_metadata.persona });
        delete chat_metadata.persona;
    }
    chat_metadata.party = JSON.parse(JSON.stringify(partyMembers));
    console.log('savePartyToMetadata saving party to chat_metadata', { partyMembers, chat_metadata });
    try {
        await saveMetadata();
    } catch (e) {
        console.warn('Unable to save party to chat metadata', e);
    }
}

/**
 * Computes a display name for a party entry from world info.
 * Uses comment first, then dndData.name, then first key, then group.
 * @param {{comment?: string, dndData?: any, key?: string[], group?: string}} entry
 * @returns {string}
 */
export function getPartyEntryDisplayName(entry) {
    const comment = String(entry.comment || '').trim();
    const dataName = String(entry.dndData?.name || '').trim();
    const keys = Array.isArray(entry.key) ? entry.key.filter(Boolean) : [];
    if (comment && comment !== 'Untitled') return comment;
    if (dataName) return dataName;
    if (keys.length) return keys[0];
    return String(entry.group || 'Unknown Character');
}

/**
 * Returns a fallback name for party members that are missing real titles.
 * @param {Partial<PartyMember>} member
 * @returns {string}
 */
function getPartyMemberFallbackName(member) {
    const parts = [];
    if (member.group) parts.push(member.group);
    if (member.class) parts.push(member.class);
    if (member.level) parts.push(`Lv ${member.level}`);
    if (member.alignment) parts.push(member.alignment);
    return parts.filter(Boolean).join(' ') || 'Party Member';
}

/**
 * Loads party from chat_metadata.party (per-session) and renders.
 */
export function loadPartyForChat() {
    console.log('loadPartyForChat called', { chat_metadata });
    if (chat_metadata?.party && Array.isArray(chat_metadata.party) && chat_metadata.party.length > 0) {
        setPartyMembers(chat_metadata.party
            .filter((member) => member && member.id && member.name)
            .map((member) => migratePartyMember(member)));
        setPartyMembers(partyMembers.map((member) => {
            if (member.name === 'Untitled') {
                const fallbackName = getPartyMemberFallbackName(member);
                console.log('Replacing Untitled party member name with fallback', { member, fallbackName });
                return { ...member, name: fallbackName };
            }
            return member;
        }));
        console.log('Loaded party from chat_metadata', { partyMembers });
        // Clear any locked persona when party is active
        if (partyMembers.length > 0 && chat_metadata?.persona) {
            console.log('Clearing locked chat persona due to active party', { persona: chat_metadata.persona });
            delete chat_metadata.persona;
        }
        // Restore party leader as active speaker
        if (partyMembers.length > 0) {
            console.log('Restoring active chat speaker to party leader', partyMembers[0].name);
            setUserName(partyMembers[0].name, { toastPersonaNameChange: false });
        }
    } else {
        console.log('No party found in chat_metadata');
        setPartyMembers([]);
    }
    loadCurrentLocation();
    loadCombatState();
    renderPartyMembers();
}

/**
 * @param {any} entry
 * @returns {string}
 */
function getDndEntryName(entry) {
    const comment = String(entry?.comment || '').trim();
    const dndName = String(entry?.dndData?.name || '').trim();
    if (comment && comment !== 'Untitled') return comment;
    if (dndName) return dndName;
    if (Array.isArray(entry?.key) && entry.key.length) return String(entry.key[0]).trim();
    if (entry?.key && String(entry.key).trim()) return String(entry.key).trim();
    return 'Unnamed';
}

/**
 * @param {any} entry
 * @returns {'none'|'character'|'npc'|'monster'|'race'|'class'|'faction'|'location'}
 */
export function getDndEntryType(entry) {
    const explicit = normalizeDndEntityType(entry?.dndData?.entityType);
    if (explicit !== 'none') return explicit;

    const group = String(entry?.group || '').trim().toLowerCase();
    if (!group) return 'none';
    if (group.includes('monster')) return 'monster';
    if (group.includes('character')) return 'character';
    if (group.includes('class')) return 'class';
    if (group.includes('race')) return 'race';
    if (group.includes('faction')) return 'faction';
    if (group.includes('location')) return 'location';
    return 'none';
}

/**
 * @param {any} value
 * @returns {string[]}
 */
function parseFactionValues(value) {
    if (Array.isArray(value)) {
        return value.map(x => String(x).trim()).filter(Boolean);
    }
    return String(value || '').split(/,\s*/).map(x => x.trim()).filter(Boolean);
}

/**
 * @param {any} entry
 * @returns {Partial<PartyMember>}
 */
function extractClassPreset(entry) {
    const d = entry?.dndData || {};
    const toNumber = (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    };

    return {
        strength: toNumber(d.str ?? d.strength),
        dexterity: toNumber(d.dex ?? d.dexterity),
        constitution: toNumber(d.con ?? d.constitution),
        intelligence: toNumber(d.int ?? d.intelligence),
        wisdom: toNumber(d.wis ?? d.wisdom),
        charisma: toNumber(d.cha ?? d.charisma),
        armorClass: toNumber(d.ac ?? d.armorClass),
        speed: toNumber(d.speed),
        hp: toNumber(d.hp ?? d.maxHp),
        maxHp: toNumber(d.maxHp ?? d.hp),
    };
}

/**
 * @param {string|null} worldName
 * @returns {Promise<DndCatalog>}
 */
export async function loadDndCatalog(worldName) {
    /** @type {DndCatalog} */
    const catalog = {
        races: [],
        classes: [],
        factions: [],
        locations: [],
        classPresets: new Map(),
    };

    if (!worldName) return catalog;
    const data = await loadWorldInfo(worldName);
    if (!data?.entries) return catalog;

    const races = new Set();
    const classes = new Set();
    const factions = new Set();
    const locations = new Set();

    for (const entry of Object.values(data.entries)) {
        const type = getDndEntryType(entry);
        const name = getDndEntryName(entry);

        if (type === 'race' && name) races.add(name);
        if (type === 'class' && name) {
            classes.add(name);
            catalog.classPresets.set(name, extractClassPreset(entry));
        }
        if (type === 'faction' && name) factions.add(name);
        if (type === 'location' && name) locations.add(name);

        const d = entry?.dndData || {};
        if (d.race) races.add(String(d.race).trim());
        if (d.charClass) classes.add(String(d.charClass).trim());
        parseFactionValues(d.factions || d.faction).forEach(x => factions.add(x));
        if (d.locationName || d.location) {
            locations.add(String(d.locationName || d.location).trim());
        }
    }

    const locationMaps = Array.isArray(data.metadata?.locationMaps) ? data.metadata.locationMaps : [];
    for (const loc of locationMaps) {
        if (loc?.name) locations.add(String(loc.name).trim());
    }

    catalog.races = Array.from(races).filter(Boolean).sort((a, b) => a.localeCompare(b));
    catalog.classes = Array.from(classes).filter(Boolean).sort((a, b) => a.localeCompare(b));
    catalog.factions = Array.from(factions).filter(Boolean).sort((a, b) => a.localeCompare(b));
    catalog.locations = Array.from(locations).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return catalog;
}

/**
 * Shows a popup to pick a single WI character entry.
 * @param {Array<any>} charEntries - WI entries with group "Characters"
 * @returns {Promise<any|null>} Selected entry or null
 */
export async function showCharacterPicker(charEntries) {
    let selectedEntry = null;

    let gridHtml = '<div class="party-picker-grid">';
    for (const entry of charEntries) {
        const uid = String(entry.uid);
        const name = getPartyEntryDisplayName(entry);
        const image = entry.dndData?.image || '';
        const race = entry.dndData?.race || '';
        const charClass = entry.dndData?.charClass || '';
        const level = entry.dndData?.level ? `nivel ${entry.dndData.level}` : '';
        const subtitle = [race, charClass, level].filter(Boolean).join(' · ');

        const imgHtml = image
            ? `<img src="${escapeHtml(image)}" alt="" />`
            : '<i class="fa-solid fa-user fa-2x"></i>';

        gridHtml += `
        <div class="party-card" data-uid="${escapeHtml(uid)}">
            <div class="party-card-img">${imgHtml}</div>
            <div class="party-card-info">
                <div class="party-card-name">${escapeHtml(name)}</div>
                ${subtitle ? `<div class="party-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
            </div>
            <div class="party-card-check"><i class="fa-solid fa-check"></i></div>
        </div>`;
    }
    gridHtml += '</div>';

    const headerHtml = `<h3 style="margin:0 0 6px"><i class="fa-solid fa-user-plus"></i> Sumar a alguien al grupo</h3>
        <p style="margin:0 0 10px;font-size:0.85rem;color:var(--SmartThemeQuoteColor,#999)">Elige a alguien del mundo para que vaya con vosotros.</p>`;

    const content = $(`<div class="party-picker-container">${headerHtml}${gridHtml}</div>`);

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, undefined, {
        wider: true,
        okButton: 'Sumarlo al grupo',
        cancelButton: 'Cancelar',
        allowVerticalScrolling: true,
        onOpen: () => {
            content.on('click', '.party-card', function () {
                content.find('.party-card').removeClass('selected');
                $(this).addClass('selected');
                selectedEntry = charEntries.find(e => String(e.uid) === String($(this).data('uid'))) || null;
            });
        },
    });

    const result = await popup.show();
    if (result === POPUP_RESULT.AFFIRMATIVE && selectedEntry) {
        return selectedEntry;
    }
    return null;
}

/**
 * Sets party members from world info character entries (used by campaign party picker).
 * Creates proper PartyMember objects from world info dndData.
 * @param {Array<{comment: string, dndData: any, key: string[], group?: string, uid?: number}>} entries
 * @param {string|null} [worldName]
 */
/**
 * Idea 179: el veterano que se trae de otra partida llega con lo puesto y sus mejoras.
 *
 * @param {{items: any[], equippedItems: Record<string, string>, perks: string[]}} gear
 */
export function adoptVeteranGear(gear) {
    const hero = partyMembers[0];
    if (!hero) return;
    hero.items = Array.isArray(gear?.items) ? JSON.parse(JSON.stringify(gear.items)) : [];
    hero.equippedItems = { ...(hero.equippedItems ?? {}), ...(gear?.equippedItems ?? {}) };
    /** @type {any} */ (hero).perks = Array.isArray(gear?.perks) ? [...gear.perks] : [];
    savePartyState();
    renderPartyMembers();
}

/**
 * J1.3: el equipo con el que empieza el héroe nuevo, puesto.
 *
 * @param {any[]} pieces Las piezas del kit (`campaign/starting-kit.js`).
 * @param {Record<string, number>} slots Dónde va cada una, por su índice.
 */
export function giveStartingGear(pieces, slots) {
    const hero = partyMembers.find(m => !m.guest);
    if (!hero || !Array.isArray(pieces) || pieces.length === 0) return;
    const items = pieces.map(piece => createItem(/** @type {any} */ (piece)));
    hero.items = [...(Array.isArray(hero.items) ? hero.items : []), ...items];
    hero.equippedItems = { ...(hero.equippedItems ?? {}) };
    for (const [slot, index] of Object.entries(slots ?? {})) {
        if (items[index]) hero.equippedItems[slot] = items[index].id;
    }
    savePartyState();
    renderPartyMembers();
}

export function setPartyFromWorldEntries(entries, worldName = null) {
    console.log('setPartyFromWorldEntries called', { entriesCount: entries?.length, entries, worldName });
    // Auto-detect world name from chat metadata if not provided
    const resolvedWorldName = worldName || (chat_metadata ? chat_metadata[METADATA_KEY] : null) || null;
    setPartyMembers([]);
    const defaults = getDefaultDndData();
    for (const entry of entries) {
        const d = entry.dndData || {};
        const memberName = getPartyEntryDisplayName(entry);
        /** @type {PartyMember} */
        const member = {
            id: Date.now() + Math.floor(Math.random() * 10000),
            personaId: null,
            wiUid: entry.uid != null ? Number(entry.uid) : null,
            worldName: resolvedWorldName,
            name: memberName,
            group: entry.group || '',
            avatar: d.image || 'img/user-default.png',
            level: Number(d.level) || 1,
            class: d.charClass || 'Adventurer',
            race: d.race || '',
            // Idea 49: el trasfondo, que las tiradas leen.
            background: d.background || '',
            // J1.4: cómo se presenta, que decide si el texto dice «cansado» o «cansada».
            gender: d.gender || '',
            factions: parseFactionValues(d.factions || d.faction),
            hp: Number(d.maxHp) || 30,
            maxHp: Number(d.maxHp) || 30,
            xp: 0,
            xpNext: 100,
            gold: 0,
            silver: 0,
            copper: 0,
            inventory: '',
            conditions: '',
            alignment: d.alignment || '',
            personality: d.personality || '',
            activeConditions: /** @type {string[]} */ ([]),
            strength: Number(d.str) || defaults.strength,
            dexterity: Number(d.dex) || defaults.dexterity,
            constitution: Number(d.con) || defaults.constitution,
            intelligence: Number(d.int) || defaults.intelligence,
            wisdom: Number(d.wis) || defaults.wisdom,
            charisma: Number(d.cha) || defaults.charisma,
            armorClass: Number(d.ac) || defaults.armorClass,
            speed: Number(d.speed) || defaults.speed,
            items: [],
            equippedItems: { ...defaults.equippedItems },
            relationships: [],
            memories: [],
            mapPosition: resolveEntryMapPosition(d),
            // R3: lo que la ficha del mundo dice que sabe hacer (se escribía y no se leía).
            abilities: abilityIdsOf(d),
        };
        partyMembers.push(member);
    }
    renderPartyMembers();
    // Y el tablero, que es donde se les ve. Antes solo se repintaba la tira: quien se
    // hacia un personaje al entrar, o reclutaba a alguien desde el editor, no aparecia
    // sobre el mapa hasta recargar la pagina.
    renderLocationMapsPreview();
    savePartyState();
    console.log('setPartyFromWorldEntries built partyMembers', { partyMembers });
    // Set party leader as active chat speaker
    if (partyMembers.length > 0) {
        console.log('Setting active chat speaker to party leader', partyMembers[0].name);
        setUserName(partyMembers[0].name, { toastPersonaNameChange: false });
    }
}

export function renderPartyMembers() {
    const list = $('#rm_party_list');
    if (!list.length) return;

    list.empty();

    if (partyMembers.length === 0) {
        list.append(
            '<div class="flex-container alignitemscenter justifyCenter padding10"><small>Todavía no hay nadie en el grupo.</small></div>',
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
                        <button class="party-card-remove menu_button fa-solid fa-trash-can" title="Sacar del grupo"></button>
                    </div>
                    <div class="party-card-meta">
                        <span title="Nivel">Nivel ${member.level}</span>
                        <span>${member.class}</span>
                    </div>
                    <div class="party-card-stats">
                        <div class="party-card-stat">
                            <div class="stat-label">PG</div>
                            <div class="stat-value">${member.hp}/${member.maxHp}</div>
                        </div>
                        <div class="party-card-stat">
                            <div class="stat-label">PX</div>
                            <div class="stat-value">${member.xp}</div>
                        </div>
                    </div>
                </div>
            </div>`,
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

/**
 * Un miembro del grupo recien salido de su ficha del Lorebook.
 *
 * Empieza entero y con los bolsillos vacios, porque entrar al grupo no es continuar una
 * partida: la vida, el oro y la mochila son de quien ya jugaba.
 *
 * @param {any} entry
 * @param {string|null} worldName
 * @returns {PartyMember}
 */
export function memberFromEntry(entry, worldName) {
    const d = entry?.dndData || {};
    const defaults = getDefaultDndData();

    return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        personaId: null,
        wiUid: entry?.uid != null ? Number(entry.uid) : null,
        worldName: worldName,
        name: getPartyEntryDisplayName(entry),
        group: entry?.group || '',
        avatar: d.image || 'img/user-default.png',
        level: Number(d.level) || 1,
        class: d.charClass || 'Adventurer',
        race: d.race || '',
        background: d.background || '',
        gender: d.gender || '',
        factions: parseFactionValues(d.factions || d.faction),
        hp: Number(d.maxHp) || 30,
        maxHp: Number(d.maxHp) || 30,
        xp: 0,
        xpNext: 100,
        gold: 0,
        silver: 0,
        copper: 0,
        inventory: '',
        conditions: '',
        alignment: d.alignment || '',
        personality: d.personality || '',
        activeConditions: /** @type {string[]} */ ([]),
        strength: Number(d.str) || defaults.strength,
        dexterity: Number(d.dex) || defaults.dexterity,
        constitution: Number(d.con) || defaults.constitution,
        intelligence: Number(d.int) || defaults.intelligence,
        wisdom: Number(d.wis) || defaults.wisdom,
        charisma: Number(d.cha) || defaults.charisma,
        armorClass: Number(d.ac) || defaults.armorClass,
        speed: Number(d.speed) || defaults.speed,
        items: [],
        equippedItems: { ...defaults.equippedItems },
        relationships: [],
        memories: [],
        mapPosition: resolveEntryMapPosition(d),
        abilities: abilityIdsOf(d),
    };
}

/**
 * R3: lo que sabe hacer una ficha del mundo, como ids del catálogo. La ficha puede traer
 * filas enteras (las que escribe el creador de personaje) o solo ids.
 *
 * @param {any} dnd
 * @returns {string[]}
 */
function abilityIdsOf(dnd) {
    return [...new Set((Array.isArray(dnd?.abilities) ? dnd.abilities : [])
        .map((/** @type {any} */ a) => String(typeof a === 'string' ? a : a?.id ?? '').trim())
        .filter(Boolean))];
}

/**
 * Pone el grupo al dia con lo que dicen las fichas, sin rehacerlo.
 *
 * `setPartyFromWorldEntries` construye el grupo de cero, y eso aqui seria un desastre:
 * devolveria a todos los puntos de vida llenos, con cero de oro y la mochila vacia. Lo
 * que cambia en el editor es la ficha — nombre, clase, caracteristicas, cara — y eso es
 * lo unico que se copia encima.
 *
 * @param {any} entries Las fichas ya guardadas.
 * @param {string} worldName
 */
export function syncPartyWithEntries(entries, worldName) {
    const rows = Object.entries(entries ?? {})
        .filter(([, entry]) => getDndEntryType(entry) === 'character');
    const playable = new Set(rows.map(([uid]) => Number(uid)));

    // Quien ha dejado de ser del grupo sale de la tira, pero no se borra del mundo.
    const left = partyMembers.filter(member => member.wiUid != null && !playable.has(Number(member.wiUid)));
    if (left.length > 0) {
        setPartyMembers(partyMembers.filter(member => !left.includes(member)));
    }

    for (const [uid, entry] of rows) {
        const d = /** @type {any} */ (entry)?.dndData || {};
        const existing = partyMembers.find(member => Number(member.wiUid) === Number(uid));

        if (!existing) {
            partyMembers.push(memberFromEntry(entry, worldName));
            continue;
        }

        existing.name = getPartyEntryDisplayName(entry);
        existing.level = Number(d.level) || existing.level;
        existing.class = d.charClass || existing.class;
        existing.race = d.race ?? existing.race;
        existing.background = d.background ?? existing.background;
        existing.avatar = d.image || existing.avatar;
        existing.personality = d.personality ?? existing.personality;
        existing.strength = Number(d.str) || existing.strength;
        existing.dexterity = Number(d.dex) || existing.dexterity;
        existing.constitution = Number(d.con) || existing.constitution;
        existing.intelligence = Number(d.int) || existing.intelligence;
        existing.wisdom = Number(d.wis) || existing.wisdom;
        existing.charisma = Number(d.cha) || existing.charisma;
        existing.armorClass = Number(d.ac) || existing.armorClass;
        existing.speed = Number(d.speed) || existing.speed;

        // Subir el maximo cura esa diferencia; bajarlo no mata a nadie.
        const maxHp = Number(d.maxHp) || existing.maxHp;
        if (maxHp !== existing.maxHp) {
            existing.hp = Math.max(0, Math.min(maxHp, existing.hp + Math.max(0, maxHp - existing.maxHp)));
            existing.maxHp = maxHp;
        }
        existing.mapPosition = resolveEntryMapPosition(d);
    }

    renderPartyMembers();
    savePartyState();

    if (left.length > 0) {
        toastr.info(`${left.map(m => m.name).join(', ')} ya no ${left.length === 1 ? 'juega' : 'juegan'} en el grupo.`);
    }
}

/**
 * Lo de tu gente del último `partySnapshot`, y de qué chat salió. J7.4: y la formación.
 *
 * @type {{chat: string, people: ReturnType<typeof packPeople>, formation?: ReturnType<typeof packFormation>}|null}
 */
let carriedPeople = null;

/**
 * J4: el grupo tal cual está, para llevarlo a otro chat.
 *
 * @returns {PartyMember[]}
 */
export function partySnapshot() {
    // J14.6: con el grupo salen sus vínculos y lo de su gente; `adoptCarriedParty` los deja en
    // el chat de llegada. Hasta ahora los vínculos se quedaban en el chat de donde se salía.
    carriedPeople = { chat: String(getCurrentChatId() ?? ''), people: packPeople(partyMembers), formation: packFormation() };
    return JSON.parse(JSON.stringify(partyMembers));
}

/**
 * J4: el grupo que llega de otro chat (del gremio a una campaña, o de vuelta). Llega entero;
 * de lo que había aquí solo se queda dónde estaba cada uno.
 *
 * @param {PartyMember[]} carried
 * @param {{worldName: string, uids?: Record<string, number>, atStart?: boolean}} where
 *   `atStart`: en una campaña recién empezada, cada uno a su casilla de salida.
 */
export function adoptCarriedParty(carried, { worldName, uids = {}, atStart = false }) {
    const lead = partyMembers[0]?.mapPosition ?? { locationName: currentLocationName, gridX: 1, gridY: 1 };
    setPartyMembers(hubRoster(settleCarried({ carried, here: partyMembers, worldName, uids, lead }))
        .map(member => migratePartyMember(member)));
    // J14.6: los vínculos y lo social llegan con el grupo, si viene de otro chat.
    if (carriedPeople && carriedPeople.chat !== String(getCurrentChatId() ?? '')) {
        unpackPeople(carriedPeople.people);
        // J7.4: la formación, con los ids de aquí (antes de ponerlos en sus casillas).
        unpackFormation(carriedPeople.formation ?? null);
    }
    carriedPeople = null;
    if (atStart) placePartyAtStart(getActiveBoardContext().board);
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    if (partyMembers[0]) setUserName(partyMembers[0].name, { toastPersonaNameChange: false });
    if (isShellOpen()) refreshGameShell();
}

/** @returns {number} El oro de todo el grupo, que es de todos. */
export function partyPurse() {
    return partyMembers.reduce((sum, m) => sum + Math.max(0, Number(m.gold) || 0), 0);
}

/**
 * Pagar del bolsillo del grupo, empezando por quien mas lleva.
 *
 * @param {number} amount
 * @returns {boolean} Si llegaba.
 */
export function payFromParty(amount) {
    if (partyPurse() < amount) return false;
    let owed = amount;
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
    }
    return true;
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
    /** @type {{hp_current?: number, hp_max?: number, xp_current?: number, xp_next?: number, level?: number, gold?: number, silver?: number, copper?: number, inventory?: string, conditions?: string, strength?: number, dexterity?: number, constitution?: number, intelligence?: number, wisdom?: number, charisma?: number, armorClass?: number, speed?: number}|null} */
    const personaState = isPersonaId ? descriptor[personaIdOrName]?.player_state : null;
    const defaults = getDefaultDndData();
    const base = {
        id: Date.now(),
        personaId: isPersonaId ? personaIdOrName : null,
        name,
        avatar,
        level: personaState?.level ?? 1,
        class: 'Adventurer',
        race: '',
        factions: [],
        hp: personaState?.hp_current ?? 30,
        maxHp: personaState?.hp_max ?? 30,
        xp: personaState?.xp_current ?? 0,
        xpNext: personaState?.xp_next ?? 100,
        gold: personaState?.gold ?? 0,
        silver: personaState?.silver ?? 0,
        copper: personaState?.copper ?? 0,
        inventory: personaState?.inventory ?? '',
        conditions: personaState?.conditions ?? '',
        alignment: '',
        personality: '',
        activeConditions: /** @type {string[]} */ ([]),
        strength: personaState?.strength ?? defaults.strength,
        dexterity: personaState?.dexterity ?? defaults.dexterity,
        constitution: personaState?.constitution ?? defaults.constitution,
        intelligence: personaState?.intelligence ?? defaults.intelligence,
        wisdom: personaState?.wisdom ?? defaults.wisdom,
        charisma: personaState?.charisma ?? defaults.charisma,
        armorClass: personaState?.armorClass ?? defaults.armorClass,
        speed: personaState?.speed ?? defaults.speed,
        items: [],
        equippedItems: { ...defaults.equippedItems },
        relationships: [],
        memories: [],
        mapPosition: { locationName: currentLocationName, gridX: 0, gridY: 0 },
    };

    partyMembers.push(base);
    renderPartyMembers();
    savePartyState();
}

/**
 * @param {number} memberId
 */
export function removePartyMember(memberId) {
    setPartyMembers(partyMembers.filter((m) => m.id !== memberId));
    renderPartyMembers();
    savePartyState();
}

/**
 * @param {string} avatarId
 * @param {{hp_current?: number, hp_max?: number, xp_current?: number, xp_next?: number, level?: number, gold?: number, silver?: number, copper?: number, inventory?: string, conditions?: string, strength?: number, dexterity?: number, constitution?: number, intelligence?: number, wisdom?: number, charisma?: number, armorClass?: number, speed?: number}} newState
 */
export function updatePartyMemberFromPersona(avatarId, newState) {
    let changed = false;
    setPartyMembers(partyMembers.map((member) => {
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
            strength: newState.strength ?? member.strength,
            dexterity: newState.dexterity ?? member.dexterity,
            constitution: newState.constitution ?? member.constitution,
            intelligence: newState.intelligence ?? member.intelligence,
            wisdom: newState.wisdom ?? member.wisdom,
            charisma: newState.charisma ?? member.charisma,
            armorClass: newState.armorClass ?? member.armorClass,
            speed: newState.speed ?? member.speed,
        };
    }));

    if (changed) {
        renderPartyMembers();
        savePartyState();
    }
}

/**
 * Returns the current party leader (first member), or null if no party is active.
 * @returns {PartyMember|null}
 */
export function getActivePartyLeader() {
    return partyMembers.length > 0 ? partyMembers[0] : null;
}

export function getPartyDescription() {
    if (!partyMembers.length) {
        return '';
    }

    return partyMembers
        .map((member) => {
            const parts = [];
            parts.push(`Nombre: ${member.name}`);
            parts.push(`Clase: ${member.class}`);
            parts.push(`Nivel: ${member.level}`);
            parts.push(`HP: ${member.hp}/${member.maxHp}`);
            parts.push(`STR:${member.strength || 10} DEX:${member.dexterity || 10} CON:${member.constitution || 10} INT:${member.intelligence || 10} WIS:${member.wisdom || 10} CHA:${member.charisma || 10}`);
            parts.push(`AC: ${member.armorClass || 10} Speed: ${member.speed || 30}`);
            const equippedNames = Object.values(member.equippedItems || {}).filter(Boolean).map(id => (member.items || []).find(i => i.id === id)?.name).filter(Boolean);
            if (equippedNames.length) parts.push(`Equipado: ${equippedNames.join(', ')}`);
            if (member.inventory) parts.push(`Inventario: ${member.inventory}`);
            if (member.conditions) parts.push(`Condiciones: ${member.conditions}`);
            return parts.join(' | ');
        })
        .join('\n');
}
