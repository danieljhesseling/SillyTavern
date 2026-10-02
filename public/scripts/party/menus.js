/**
 * Las ventanas que se abren desde la pausa y los comandos: el diario, la ayuda, el glosario,
 * las reglas, el compendio, el salón de la fama, la sesión, el taller y el editor de campaña.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata, generateRaw, online_status } from '../../script.js';
import { extension_settings } from '../extensions.js';
import {
    getCurrentWorldLocationMaps, getCurrentWorldEnemies, loadWorldInfo, saveWorldInfo, createWorldInfoEntry,
    refreshWorldMapGlobals, METADATA_KEY,
} from '../world-info.js';
import { addItemToInventory, createItem } from '../dnd-system.js';
import { escapeHtml, download } from '../utils.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { getCompendium } from '../game-engine/compendio/browser.js';
import { ensureSeed, derive, describeSeed } from '../game-engine/campaign/seed.js';
import { travelEvents, rollWeather } from '../game-engine/world/travel.js';
import { forgeItem as forgeFromCompendium, forgeItems, describeItem } from '../game-engine/compendio/forge.js';
import { makeNames } from '../game-engine/compendio/names.js';
import { breedMonster as breedFromCompendium, breedBand, describeMonster } from '../game-engine/compendio/bestiary.js';
import { writeQuest as writeFromCompendium, writeQuestBoard, describeQuest } from '../game-engine/compendio/quests.js';
import {
    writePerson as writePersonFromCompendium, writeVillage, describePerson,
} from '../game-engine/compendio/people.js';
import { racesOf, kindsOf, describeKin, validateKin } from '../game-engine/compendio/kin.js';
import { describeFaction, rollFactions, validateFactionRows, namesOf } from '../game-engine/campaign/factions.js';
import { abilitiesFor, classesOf, nameAndAbility, validateAbilities } from '../game-engine/compendio/skills.js';
import { weaponOf as heldWeapon } from '../game-engine/rules/equipment.js';
import { buildHowToPlay } from '../game-engine/campaign/how-to-play.js';
import { getMapLegend } from '../game-engine/campaign/campaign-pack-schema.js';
import { knownSpells } from '../game-engine/rules/grimoire.js';
import { describeMounts } from '../game-engine/world/mounts.js';
import { describeSecrets } from '../game-engine/campaign/npc-secrets.js';
import { dialogueJournal } from '../game-engine/campaign/dialogues.js';
import { checkWorldDensity, gemRequest } from '../game-engine/campaign/world-density.js';
import { makeShareCode } from '../game-engine/campaign/share-code.js';
import { HUB_HEROES_KEY, restingUids } from '../game-engine/campaign/hub-heroes.js';
import { previewOf, describePreview } from '../game-engine/campaign/world-preview.js';
import { readIllustrationSettings, promptFor, buildRequest, imageFrom } from '../game-engine/campaign/illustrations.js';
import { newPerson, newPlace } from '../game-engine/campaign/director.js';
import { describeInjuries } from '../game-engine/rules/injuries.js';
import { describeNeeds } from '../game-engine/rules/needs.js';
import { describeMode as describeGameMode } from '../game-engine/rules/modes.js';
import { readGraves, describeHallEntry } from '../game-engine/campaign/legacy.js';
import { describeFame } from '../game-engine/campaign/fame.js';
import { SKILLS } from '../game-engine/rules/checks.js';
import { buildJournal, buildHelp } from '../game-engine/campaign/guidance.js';
import { glanceRow } from '../game-engine/ui/shell/notices.js';
import { readSession, describeSession } from '../game-engine/campaign/session-log.js';
import { describeUpcoming } from '../game-engine/campaign/upcoming.js';
import { mapRows, describeRoute, setNote } from '../game-engine/campaign/text-map.js';
import { chronicleOf, chronicleSections } from '../game-engine/campaign/chronicle.js';
import {
    focusOf, secretsOf, omensOf, daysLeftOf, cluesOf, closedOf, readPlotState,
} from '../game-engine/campaign/plot.js';
import { diceStats, readRolls } from '../game-engine/campaign/dice-log.js';
import { bump, describeStats } from '../game-engine/campaign/stats.js';
import { GLOSSARY } from '../game-engine/ui/shell/tips.js';
import { heroStory } from '../game-engine/campaign/feats.js';
import { memoryLines } from '../game-engine/campaign/memories.js';
import { generateBoard } from '../game-engine/world-builder/dungeon-generator.js';
import { describeLootItem } from '../game-engine/combat/loot-items.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { openStoryBook } from '../game-engine/ui/story-book.js';
import { buildPackFromWorld, describeExport } from '../game-engine/campaign/campaign-export.js';
import { normalizePack, validatePack } from '../game-engine/campaign/campaign-pack.js';
import {
    ART_STORAGE, DEEDS_KEY, DIALOGUE_MEMORY_KEY, DICE_LOG_KEY, FAME_KEY, GRAVES_KEY, HINTS_KEY, MAP_NOTES_KEY, MEMORIES_KEY,
    MOUNTS_KEY, PLOT_DECISIONS_KEY, PLOT_KEY, PLOT_STATE_KEY, RUMORS_HEARD_KEY, RUMORS_HEARD_ON_KEY, SECRETS_KEY,
    SESSION_LOG_KEY, STATS_KEY, TAKEN_KEY, VISITED_KEY,
} from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCurrentBoardName,
    setCurrentLocationName, setWorldItemCatalogue, worldItemCatalogue,
} from './state.js';
import { currentPet } from './pet.js';
import { enterBoard } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import {
    applyCampaignRuleset, biomeHere, campaignCompendium, currentSeason, getLocationBoards, hereLocation,
    lastPack, lastRumors, lastWorldNpcs, reloadWorldFactions, saveCurrentBoard, saveCurrentLocation, seedOfWorld,
    travelLocations,
} from './world.js';
import { bannerOf, friendlyFactions } from './factions.js';
import { campaignDay, getCampaignBonds, getCampaignCalendar, whatComes } from './time.js';
import { campaignBook, getPlot, openMilestones } from './plot.js';
import { worldWrite } from './world-growth.js';
import { survivalNow } from './modes.js';
import { narratorMode, offlineGame, postCombatNarration, whoPlays } from './narration.js';
import { savePartyState, syncPartyWithEntries } from './roster.js';
import { openFormationPanel, partyMorale, personalQuestJournal } from './companions.js';
import { neighbourPlaces } from './travel.js';
import { buildServiceCards, runService } from './town.js';
import { buildShellChips, runShellChip } from './shell.js';
import { hallShown, romanceGlanceLine } from './romance.js';
import { knownPeopleJournal } from './known-people.js';

/** Ideas 69 y 70: el mapa en texto, con niebla y con notas. */
export async function openTextMap() {
    if (!chat_metadata) return;
    const rows = mapRows({
        // J10.1: con sus puertas, como el viaje.
        locations: travelLocations(),
        here: currentLocationName,
        visited: chat_metadata[VISITED_KEY] ?? [],
        notes: chat_metadata[MAP_NOTES_KEY] ?? {},
        friendly: friendlyFactions(),
        season: currentSeason(),
        done: readPlotState(chat_metadata[PLOT_STATE_KEY]).done,
    });
    const body = $('<div class="tm-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('El mapa'));
    body.append($('<p class="tm-intro"></p>').text('Lo que no habéis pisado sale en gris, y un camino que no sale de ningún sitio conocido no se sabe adónde lleva. Cada sitio admite una nota tuya.'));
    for (const row of rows) {
        const item = $('<div class="tm-place"></div>').attr('data-state', row.state).attr('data-place', row.name);
        item.append($('<div class="tm-name"></div>').text(`${row.name}${row.state === 'aqui' ? ' · aquí' : row.state === 'sin-visitar' ? ' · sin visitar' : ''}`));
        for (const route of row.routes) item.append($('<div class="tm-route"></div>').toggleClass('tm-unknown', !route.known).text(describeRoute(route)));
        const note = $('<input type="text" class="text_pole tm-note" maxlength="140" placeholder="Una nota tuya…">').val(row.note);
        note.on('change', () => {
            chat_metadata[MAP_NOTES_KEY] = setNote(chat_metadata?.[MAP_NOTES_KEY], row.name, String(note.val() ?? ''));
            saveMetadata();
        });
        item.append(note);
        body.append(item);
    }
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/** @type {import('../game-engine/campaign/session-log.js').SessionLog|null} */
let sessionLog = null;

/** @returns {import('../game-engine/campaign/session-log.js').SessionLog} */
export function currentSessionLog() {
    if (!sessionLog) {
        let raw = null;
        try {
            raw = JSON.parse(sessionStorage.getItem(SESSION_LOG_KEY) || 'null');
        } catch {
            raw = null;
        }
        sessionLog = readSession(raw, Date.now());
    }
    return sessionLog;
}

/** @param {import('../game-engine/campaign/session-log.js').SessionLog} next */
export function keepSessionLog(next) {
    sessionLog = next;
    try {
        sessionStorage.setItem(SESSION_LOG_KEY, JSON.stringify(next));
    } catch {
        // Sin almacenamiento se sigue contando en memoria: se pierde al recargar, y ya.
    }
}

/** Tu sesión: minutos por escena, mensajes, llamadas y botones. */
export async function openSessionLog() {
    const { getSession } = await import('../game-engine/ui/prompt-preview.js');
    const lines = describeSession(currentSessionLog(), Date.now(), getSession());
    const body = $('<div class="sl-root"></div>');
    body.append($('<h3></h3>').text('Tu sesión'));
    for (const line of lines) body.append($('<p class="sl-line"></p>').text(line));
    // R1: y en qué modo se juega.
    body.append($('<p class="sl-line sl-mode"></p>').text(`Modo: ${describeGameMode(survivalNow())}.`));
    body.append($('<p class="sl-hint"></p>').text('Si has escrito algo en el chat porque no había un botón para ello, apúntalo: es lo que más ayuda a decidir qué construir.'));
    // U2 del pegamento: y lo que el juego da por cierto, clave a clave.
    const state = $('<button type="button" class="menu_button sl-state"></button>').text('Ver lo que el juego da por cierto');
    state.on('click', () => { void openStateView(); });
    body.append(state);
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Seguir jugando' }).show();
}

/** U2 del pegamento: el panel del estado. */
export async function openStateView() {
    const { openStatePanel } = await import('../game-engine/ui/state-panel.js');
    await openStatePanel({ metadata: chat_metadata ?? {}, Popup, POPUP_TYPE });
}

/** Idea 162: el grupo de un vistazo. */
export function openPartyGlance() {
    const bonds = getCampaignBonds();
    const body = $('<div class="pg-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('El grupo'));
    let gold = 0;
    for (const member of partyMembers) {
        const row = glanceRow(member, {
            injuries: describeInjuries(member),
            needs: describeNeeds(member),
            rank: member === partyMembers[0] ? 0 : getBondProgress(bonds, String(member.id)).rank,
        });
        gold += row.gold;
        const box = $('<div class="pg-row"></div>').addClass(`pg-${row.state}`);
        const head = $('<div class="pg-head"></div>');
        head.append($('<span class="pg-name"></span>').text(row.name));
        head.append($('<span class="pg-hp"></span>').text(`PG ${row.hp}`));
        head.append($('<span class="pg-gold"></span>').text(`${row.gold} de oro`));
        box.append(head);
        box.append($('<div class="pg-bar"></div>').append($('<div class="pg-fill"></div>').css('width', `${row.pct}%`)));
        // Idea 61: lo que lleva en la mano.
        const weapon = heldWeapon(member);
        box.append($('<div class="pg-line pg-weapon"></div>').text(weapon ? `Lleva: ${weapon.name}${weapon.damageDice ? ` (${weapon.damageDice})` : ''}` : 'Pelea con las manos'));
        for (const line of row.lines) box.append($('<div class="pg-line"></div>').text(line));
        // J14.10: cómo va el romance, si hay (y si está encendido).
        const love = romanceGlanceLine(member);
        if (love) box.append($('<div class="pg-line pg-romance"></div>').text(love));
        // Idea 57: su historia, de lo que el motor ya apunto.
        const story = $('<button type="button" class="menu_button pg-story"></button>').text('Su historia');
        story.on('click', () => openHeroStory(member));
        box.append(story);
        body.append(box);
    }
    body.append($('<div class="pg-total"></div>').text(`Oro del grupo: ${gold}`));
    // Idea 39: la moral, con lo que da.
    body.append($('<div class="pg-morale"></div>').text(`Moral: ${partyMorale().label}`));
    // J7.4: quién va delante y quién cura, guía, vigila y caza.
    /** @type {Popup|null} */
    let glance = null;
    const formation = $('<button type="button" class="menu_button pg-formation"></button>')
        .append('<i class="fa-solid fa-people-line"></i>')
        .append($('<span></span>').text(' Formación y papeles'));
    formation.on('click', async () => {
        await glance?.completeCancelled();
        await openFormationPanel();
    });
    body.append(formation);
    glance = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true });
    void glance.show();
}

/**
 * Idea 200: sumar a la partida en numeros.
 *
 * @param {'fights'|'wins'|'fled'|'deaths'|'gold'|'rumors'|'trips'|'contracts'} key
 * @param {number} [amount]
 */
export function countStat(key, amount = 1) {
    if (!chat_metadata) return;
    chat_metadata[STATS_KEY] = bump(chat_metadata[STATS_KEY], key, amount);
    saveMetadata();
}

/** @returns {string[]} La partida en numeros, en lineas. */
export function statsLines() {
    return describeStats(chat_metadata?.[STATS_KEY], {
        days: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        places: getCurrentWorldLocationMaps().length,
    });
}

/** Idea 156: el glosario, en una ventana. */
export function openGlossary() {
    const body = $('<div class="gl-root"></div>');
    body.append($('<h3></h3>').text('Glosario'));
    for (const entry of GLOSSARY) {
        const row = $('<div class="gl-row"></div>');
        row.append($('<div class="gl-term"></div>').text(entry.term));
        row.append($('<div class="gl-means"></div>').text(entry.means));
        body.append(row);
    }
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/** Idea 168: el historial de dados, con sus cuentas. */
export function openDiceHistory() {
    const stats = diceStats(chat_metadata?.[DICE_LOG_KEY]);
    const body = $('<div class="dl-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('Los dados'));
    body.append($('<div class="jr-item"></div>').text(stats.count > 0
        ? `${stats.count} tiradas de d20 · media ${String(stats.average).replace('.', ',')} · ${stats.twenties} veintes · ${stats.ones} unos`
            + (stats.judged > 0 ? ` · ${stats.passed} de ${stats.judged} salieron` : '')
        : 'Todavía no se ha tirado nada.'));
    body.append($('<div class="jr-item dl-verdict"></div>').text(stats.verdict));
    const last = readRolls(chat_metadata?.[DICE_LOG_KEY]).slice(-12).reverse();
    if (last.length > 0) body.append($('<div class="jr-title"></div>').text('Las últimas'));
    for (const roll of last) {
        body.append($('<div class="jr-item dl-roll"></div>').text(`${roll.title}: ${roll.natural}${roll.dc !== null ? ` (total ${roll.total} contra ${roll.dc})` : ''}`));
    }
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Idea 57: la historia de alguien del grupo.
 *
 * @param {any} member
 */
function openHeroStory(member) {
    const lines = heroStory({
        member,
        deeds: Array.isArray(chat_metadata?.[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [],
        memories: Array.isArray(chat_metadata?.[MEMORIES_KEY]) ? chat_metadata[MEMORIES_KEY] : [],
    });
    const body = $('<div class="hs-root"></div>');
    body.append($('<h3></h3>').text(`La historia de ${member.name}${member.nickname ? ` «${member.nickname}»` : ''}`));
    if (lines.length === 0) body.append($('<div class="jr-item"></div>').text('Todavía no ha pasado nada que contar.'));
    for (const line of lines) body.append($('<div class="jr-item"></div>').text(line));
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/** Idea 100: el diario, con lo que el grupo sabe. */
/**
 * El diario, sin fallar en silencio: si algo no se puede montar, se dice y queda en la consola
 * con su traza, en vez de que el botón no haga nada.
 */
export function openJournalSafely() {
    try {
        openJournal();
    } catch (error) {
        console.error('[party] el diario no se pudo abrir', error);
        toastr.error('El diario no se ha podido abrir. Queda anotado en la consola.', 'Diario');
    }
}

function openJournal() {
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const heardIds = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    const heard = heardIds
        .map((/** @type {string} */ id) => lastRumors.find(r => r.id === id))
        .filter(Boolean)
        .map((/** @type {any} */ r) => ({
            text: r.text, by: r.by, where: r.where, leadsTo: r.leadsTo,
            day: Number(chat_metadata?.[RUMORS_HEARD_ON_KEY]?.[r.id]) || 0,
        }));
    const sections = buildJournal({
        // Idea 106: lo que tiene plazo lo dice.
        open: openMilestones().map(m => {
            const left = daysLeftOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], m.id, today);
            return left == null ? m : { ...m, title: `${m.title} (${left === 0 ? 'hoy es el último día' : `quedan ${left} día(s)`})` };
        }),
        clues: chat_metadata?.[HINTS_KEY]?.clues ?? {},
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        today,
        heard,
        // D-J17: lo oído concuerda con quien juega.
        who: whoPlays(),
        memories: memoryLines(chat_metadata?.[MEMORIES_KEY], today),
        deeds: Array.isArray(chat_metadata?.[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [],
    });
    // U3 del pegamento: lo que viene, de todos los relojes a la vez. Lo primero del diario.
    const coming = describeUpcoming(whatComes(today), 8);
    if (coming.length > 0) sections.unshift({ title: 'Lo que viene', items: coming });
    // Idea 114: el presagio, con lo que ya se ha cumplido.
    const omens = omensOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    if (omens.length > 0) sections.push({ title: 'El presagio', items: omens.map(o => `${o.fulfilled ? '✓' : '·'} «${o.text}»`) });
    // Idea 111: los secretos, sin decir cuáles faltan.
    const secrets = secretsOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    if (secrets.total > 0) {
        sections.push({ title: `Secretos de la historia (${secrets.found.length} de ${secrets.total})`, items: secrets.found.length > 0 ? secrets.found : ['Ninguno todavía. Hay cosas que se encuentran sin buscarlas.'] });
    }
    // Idea 107: las investigaciones, con lo que falta y dónde.
    for (const case107 of cluesOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY])) {
        sections.push({
            title: `Investigación: ${case107.title} (${case107.found} de ${case107.need} pistas)`,
            items: case107.missing.map(c => `Falta: ${SKILLS[/** @type {keyof typeof SKILLS} */ (c.skill)]?.label ?? c.skill} en ${c.place}`),
        });
    }
    // Idea 102: los caminos que se cerraron.
    const closed = closedOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    if (closed.length > 0) sections.push({ title: 'Caminos cerrados', items: closed });
    // J9.6: lo que decidisteis en las escenas del hilo, y lo que quedó apuntado en ellas.
    const decided = (Array.isArray(chat_metadata?.[PLOT_DECISIONS_KEY]) ? chat_metadata[PLOT_DECISIONS_KEY] : [])
        .map((/** @type {any} */ entry) => (Number(entry?.day) > 0 ? `Día ${Number(entry.day)}: ${String(entry?.text ?? '')}` : String(entry?.text ?? entry ?? '')))
        .filter(Boolean);
    if (decided.length > 0) sections.push({ title: 'Lo que decidisteis', items: decided });
    // J8.6: lo que os han contado en las charlas escritas.
    const told8 = dialogueJournal(chat_metadata?.[DIALOGUE_MEMORY_KEY]);
    if (told8.length > 0) sections.push({ title: 'Lo que os han contado', items: told8 });
    // J13.7: la gente que conoces por su nombre, y cómo lo supiste.
    const met = knownPeopleJournal();
    if (met.length > 0) sections.push({ title: 'La gente que conoces', items: met });
    // Idea 110: lo que sabéis de la gente.
    const pried = describeSecrets(chat_metadata?.[SECRETS_KEY]);
    if (pried.length > 0) sections.push({ title: 'Lo que sabéis de la gente', items: pried });
    // Idea 129: las monturas.
    const mounts = describeMounts(chat_metadata?.[MOUNTS_KEY]);
    if (mounts) sections.push({ title: 'Monturas', items: [mounts] });
    // Idea 52: dónde os conocen.
    const known = describeFame(chat_metadata?.[FAME_KEY]);
    if (known.length > 0) sections.push({ title: 'Dónde os conocen', items: known });
    // Idea 36: quien se quedó por el camino.
    const graves = readGraves(chat_metadata?.[GRAVES_KEY]);
    if (graves.length > 0) sections.push({ title: 'Los que se quedaron', items: graves.map(g => g.epitaph) });
    // J14.9: las misiones personales de tu gente: cómo van y cómo acabaron.
    const personal = personalQuestJournal();
    if (personal.length > 0) sections.push({ title: 'Misiones de tu gente', items: personal });
    // Idea 200: mientras se juega, la partida en numeros tambien esta en el diario.
    sections.push({ title: 'La partida en números', items: statsLines() });
    // U4 del pegamento: lo que el mundo recuerda son los hechos; la crónica es todo lo que
    // pasó, sacado de lo que el juego ya contó en el chat, por categorías y con filtro.
    const remembered = sections.find(s => s.title === 'Crónica');
    if (remembered) remembered.title = 'Lo que el mundo recuerda';
    const told = chronicleSections(chronicleOf(chat), { limit: 8 });
    // J9.6: sin conexión, el Diario es un libro: capítulos (J9.3), plazos (J9.5), lo decidido y lo
    // que salió de ello (J11.5). Lo de siempre va en sus «Apuntes». Si no se puede montar, la lista.
    if (offlineGame()) {
        try {
            const book = campaignBook();
            void openStoryBook({ book, pack: lastPack, notes: sections, chronicle: told })
                .catch(error => {
                    console.error('[party] el libro del diario no se pudo abrir', error);
                    showJournalList(sections, told);
                });
            return;
        } catch (error) {
            console.error('[party] el libro del diario no se pudo montar', error);
        }
    }
    showJournalList(sections, told);
}

/**
 * El Diario de siempre: una lista por secciones, con la crónica y su filtro.
 *
 * @param {Array<{title: string, items: string[]}>} sections
 * @param {Array<{category: string, title: string, items: string[]}>} told
 * @returns {void}
 */
function showJournalList(sections, told) {
    const body = $('<div class="jr-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('Diario'));
    for (const section of sections) {
        body.append($('<div class="jr-title"></div>').text(section.title));
        for (const item of section.items) body.append($('<div class="jr-item"></div>').text(item));
    }
    if (told.length > 0) {
        body.append($('<div class="jr-title"></div>').text('Crónica'));
        const filters = $('<div class="jr-filters"></div>');
        filters.append($('<button type="button" class="menu_button jr-filter jr-filter-on" data-cat=""></button>').text('Todo'));
        for (const section of told) filters.append($('<button type="button" class="menu_button jr-filter"></button>').attr('data-cat', section.category).text(section.title));
        body.append(filters);
        for (const section of told) {
            for (const item of section.items) {
                body.append($('<div class="jr-item jr-chron"></div>').attr('data-cat', section.category).text(`${section.title}: ${item}`));
            }
        }
        body.on('click', '.jr-filter', function () {
            const only = String($(this).attr('data-cat') || '');
            body.find('.jr-filter').removeClass('jr-filter-on');
            $(this).addClass('jr-filter-on');
            body.find('.jr-chron').each(function () {
                $(this).toggle(!only || $(this).attr('data-cat') === only);
            });
        });
    }
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/** Idea 136: todo lo que se puede hacer ahora, junto y pulsable. */
export function openHelp() {
    const sections = buildHelp({
        focus: focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay()),
        services: buildServiceCards(),
        boards: currentBoardName ? [] : getLocationBoards(hereLocation()).map((/** @type {any} */ b) => String(b.name)),
        chips: buildShellChips().map(c => ({ id: c.id, label: c.label })),
        places: neighbourPlaces().length,
        fighting: Boolean(combatEncounter.active),
        engineReads: narratorMode() === 'motor',
    });
    showHelpSections('¿Qué puedo hacer aquí?', sections);
}

/**
 * La ventana de «¿Qué puedo hacer aquí?»: secciones de cosas que se pulsan.
 *
 * @param {string} title
 * @param {Array<{title: string, items: Array<{label: string, detail: string, key: string}>}>} sections
 * @returns {void}
 */
export function showHelpSections(title, sections) {
    const body = $('<div class="hp-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(title));
    /** @type {Popup|null} */
    let popup = null;
    for (const section of sections) {
        body.append($('<div class="jr-title"></div>').text(section.title));
        for (const item of section.items) {
            const row = item.key
                ? $('<button type="button" class="menu_button hp-item"></button>').attr('data-key', item.key)
                : $('<div class="hp-item hp-still"></div>');
            row.append($('<span class="hp-label"></span>').text(item.label));
            if (item.detail) row.append($('<span class="hp-detail"></span>').text(item.detail));
            if (item.key) {
                row.on('click', () => {
                    void popup?.completeCancelled();
                    runHelpItem(item.key);
                });
            }
            body.append(row);
        }
    }
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true });
    void popup.show();
}

/** @param {string} key */
function runHelpItem(key) {
    const [kind, ...rest] = key.split(':');
    const value = rest.join(':');
    if (kind === 'journal') openJournal();
    else if (kind === 'glossary') openGlossary();
    else if (kind === 'service') void runService(value);
    else if (kind === 'board') {
        enterBoard(value);
        renderLocationMapsPreview();
        if (isShellOpen()) refreshGameShell();
    } else if (kind === 'chip') {
        const chip = buildShellChips().find(c => c.id === value);
        if (chip) runShellChip(chip);
    }
}

/**
 * Ideas 175, 176, 183 y 185: el taller del mundo. Ver el mundo (y, con clave, ilustrarlo),
 * editar el hilo de esta partida, añadir a alguien o un sitio, y los ajustes de PixelLab.
 *
 * @returns {Promise<void>}
 */
export async function openWorkshop() {
    const ui = await import('../game-engine/ui/world-workshop.js');
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !chat_metadata) {
        toastr.info('Abre una campaña antes.', 'Taller del mundo');
        return;
    }
    const choice = await ui.openWorkshopMenu({ Popup, POPUP_TYPE });
    const art = readIllustrationSettings((() => { try { return JSON.parse(localStorage.getItem(ART_STORAGE) || '{}'); } catch { return {}; } })());
    if (choice === 'preview') {
        const data = await loadWorldInfo(worldName);
        const preview = previewOf({ ...(data?.metadata ?? {}), plot: chat_metadata[PLOT_KEY] ?? data?.metadata?.plot });
        const npcs = Object.values(data?.entries ?? {}).filter((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && !e.dndData.dead);
        await ui.openWorldPreview({
            lines: describePreview(preview),
            subjects: [
                ...(data?.metadata?.locationMaps ?? []).map((/** @type {any} */ l) => ({ kind: /** @type {'place'} */ ('place'), name: String(l.name), image: String(l.illustration || '') })),
                ...npcs.slice(0, 20).map((/** @type {any} */ e) => ({ kind: /** @type {'person'} */ ('person'), name: String(e.dndData.name || e.comment), image: String(e.dndData.image || '') })),
            ],
            canIllustrate: Boolean(art.key),
            onIllustrate: (kind, name) => illustrate(kind, name, art),
            Popup,
            POPUP_TYPE,
        });
    } else if (choice === 'plot') {
        await ui.openPlotEditor({
            plot: chat_metadata[PLOT_KEY],
            onSave: (plot) => {
                chat_metadata[PLOT_KEY] = plot;
                saveMetadata();
                toastr.success('El hilo queda guardado en esta partida.', 'Editar el hilo');
                if (isShellOpen()) refreshGameShell();
            },
            Popup,
            POPUP_TYPE,
        });
    } else if (choice === 'director') {
        const places = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l.name));
        const asked = await ui.openDirector({ places, Popup, POPUP_TYPE });
        if (asked) await direct(asked.kind, asked.data);
    } else if (choice === 'art') {
        const saved = await ui.openArtSettings({ settings: art, Popup, POPUP_TYPE });
        if (saved) {
            try { localStorage.setItem(ART_STORAGE, JSON.stringify(saved)); } catch { /* sin almacenamiento */ }
            toastr.success(saved.key ? 'Guardado: ya se puede ilustrar desde «Ver el mundo».' : 'Guardado, sin clave.', 'Ilustraciones');
        }
    }
}

/**
 * Idea 183: pedir una ilustración a PixelLab y guardarla en el mundo.
 *
 * @param {'place'|'person'} kind
 * @param {string} name
 * @param {{key: string, endpoint: string, size: number}} art
 * @returns {Promise<boolean>}
 */
async function illustrate(kind, name, art) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = await loadWorldInfo(worldName);
    if (!data) return false;
    const place = kind === 'place' ? (data.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => String(l.name) === name) : null;
    const entry = kind === 'person' ? Object.values(data.entries ?? {}).find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && String(e.dndData.name) === name) : null;
    const about = kind === 'place' ? String(place?.description ?? '') : String(/** @type {any} */ (entry)?.content ?? '');
    const request = buildRequest(art, promptFor({ kind, name, about, genre: String(data.metadata?.genre ?? '') }));
    if (!request) return false;
    try {
        const response = await fetch(request.url, request.init);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const image = imageFrom(await response.json());
        if (!image) throw new Error('la respuesta no trae imagen');
        await worldWrite(async () => {
            const fresh = await loadWorldInfo(worldName);
            if (!fresh) return;
            if (kind === 'place') {
                const target = (fresh.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => String(l.name) === name);
                if (target) target.illustration = image;
            } else {
                const target = Object.values(fresh.entries ?? {}).find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && String(e.dndData.name) === name);
                if (target) /** @type {any} */ (target).dndData.image = image;
            }
            await saveWorldInfo(worldName, fresh, true);
        });
        toastr.success(name, 'Ilustrado');
        return true;
    } catch (error) {
        toastr.error(`No se pudo ilustrar: ${error instanceof Error ? error.message : error}`, 'Ilustraciones');
        return false;
    }
}

/**
 * Idea 185: el director añade a alguien o un sitio al mundo, en mitad de la partida.
 *
 * @param {'person'|'place'} kind
 * @param {any} input
 * @returns {Promise<void>}
 */
async function direct(kind, input) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const known = { places: getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l.name)), people: lastWorldNpcs.map(n => n.name) };
    let said = '';
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        if (kind === 'person') {
            const made = newPerson(input, known);
            if (!made.ok) { said = made.reason; return; }
            const entry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
            if (!entry) return;
            entry.comment = made.entry.title;
            entry.key = made.entry.keys;
            entry.content = made.entry.content;
            entry.group = made.entry.group;
            entry.dndData = made.entry.dndData;
            said = `${made.entry.title} vive ahora en ${input.where}.`;
        } else {
            const made = newPlace(input, known);
            if (!made.ok) { said = made.reason; return; }
            const places = Array.isArray(data.metadata?.locationMaps) ? data.metadata.locationMaps : [];
            places.push(made.place);
            const link = places.find((/** @type {any} */ l) => String(l.name) === String(input.linkTo));
            if (link) link.routes = [...(Array.isArray(link.routes) ? link.routes : []), made.route];
            data.metadata.locationMaps = places;
            said = `${made.place.name} ya está en el mapa, a ${made.route.days} día(s) de ${input.linkTo}.`;
        }
        await saveWorldInfo(worldName, data, true);
    });
    await refreshWorldMapGlobals(worldName);
    await reloadWorldFactions();
    if (said) {
        postCombatNarration(`🎬 [DIRECTOR] ${said}`);
        toastr.info(said, 'Modo director');
    }
    if (isShellOpen()) refreshGameShell();
}

/**
 * Idea 180: el código de este mundo, para que otro lo juegue igual.
 *
 * @returns {Promise<void>}
 */
export async function shareWorld() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName) : null;
    const code = makeShareCode({ seed: seedOfWorld(data?.metadata), origin: String(data?.metadata?.origin ?? '') });
    if (!code) {
        toastr.info('Este mundo no tiene semilla: no se puede compartir con un código.', 'Compartir');
        return;
    }
    const body = $('<div class="sw-root"></div>');
    body.append($('<h3></h3>').text('Compartir este mundo'));
    body.append($('<p></p>').text('Quien escriba este código en la semilla del taller juega el mismo mundo. Lo que se cambie a mano en el taller no viaja en él.'));
    const box = $('<input type="text" class="text_pole sw-code" readonly>').val(code);
    const copy = $('<button class="menu_button sw-copy" type="button"></button>').text('Copiar');
    copy.on('click', async () => {
        try {
            await navigator.clipboard.writeText(code);
            toastr.success('Copiado.', 'Compartir');
        } catch {
            box.trigger('select');
        }
    });
    body.append($('<div class="sw-row"></div>').append(box).append(copy));
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar' }).show();
}

/**
 * Abre las reglas de encuentro del tablero en el que esta el grupo.
 *
 * Las escribe el asistente y las escribe el importador; cambiarlas obligaba a abrir World
 * Info y editar una lista de uids a mano, que es justo lo que este proyecto promete que
 * no hace falta.
 *
 * @returns {Promise<string>}
 */
export async function editBoardEncounters() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !currentBoardName) {
        toastr.warning('Entra en un tablero primero (/enter).');
        return '';
    }

    const data = await loadWorldInfo(worldName);
    const location = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board) {
        toastr.error(`No se encontro el tablero "${currentBoardName}".`);
        return '';
    }

    /** @type {Record<string, string>} */
    const namesById = {};
    /** @type {Record<string, string>} */
    const idsByName = {};
    for (const enemy of getCurrentWorldEnemies()) {
        namesById[String(enemy.id)] = String(enemy.name);
        idsByName[String(enemy.name)] = String(enemy.id);
    }

    const { openEncounterEditor } = await import('../game-engine/ui/encounter-editor.js');
    const saved = await openEncounterEditor({
        boardName: board.name,
        rules: board.encounterRules ?? [],
        namesById,
        idsByName,
        available: Object.values(namesById),
        Popup,
        POPUP_TYPE,
    });

    if (!saved) return '';

    board.encounterRules = saved;
    await saveWorldInfo(worldName, data, true);
    renderLocationMapsPreview();
    toastr.success(`${saved.length} enemigo(s) declarados en "${board.name}".`, 'Enemigos del tablero');
    return `${saved.length} reglas`;
}

/**
 * Abre los objetivos del tablero en el que esta el grupo.
 *
 * El motor juzga por ids y el editor habla de nombres, asi que las dos tablas de
 * traduccion se arman aqui, donde viven las entradas. Es la misma traduccion que hace el
 * importador de paquetes, a proposito: un objetivo escrito a mano, importado de un libro
 * o propuesto por el modelo tiene que ser el mismo objeto cuando el motor lo lee.
 *
 * @returns {Promise<string>}
 */
export async function editBoardObjectives() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !currentBoardName) {
        toastr.warning('Entra en un tablero primero (/enter).');
        return '';
    }

    const data = await loadWorldInfo(worldName);
    const location = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l.name === currentLocationName);
    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName);
    if (!board) {
        toastr.error(`No se encontro el tablero "${currentBoardName}".`);
        return '';
    }

    /** @type {Record<string, string>} */
    const namesById = {};
    /** @type {Record<string, string>} */
    const idsByName = {};
    for (const entry of Object.values(data?.entries ?? {})) {
        const name = String(/** @type {any} */ (entry).comment || '').trim();
        if (!name) continue;
        namesById[String(/** @type {any} */ (entry).uid)] = name;
        idsByName[name] = String(/** @type {any} */ (entry).uid);
    }

    const enemies = [...new Set((board.enemyPlacements ?? []).map((/** @type {any} */ p) => String(p.name)))];
    const allies = partyMembers.map(m => m.name);

    const { openObjectiveEditor } = await import('../game-engine/ui/objective-editor.js');
    const saved = await openObjectiveEditor({
        boardName: board.name,
        objectives: board.objectives ?? [],
        namesById,
        idsByName,
        enemies: enemies.length > 0 ? enemies : Object.values(namesById),
        allies,
        width: Number(location?.gridWidth) || 0,
        height: Number(location?.gridHeight) || 0,
        // Sin proveedor no se ofrece el boton: pedirselo a nadie no es una opcion.
        generate: online_status !== 'no_connection' ? (params) => generateRaw(params) : null,
        Popup,
        POPUP_TYPE,
    });

    if (!saved) return '';

    board.objectives = saved;
    await saveWorldInfo(worldName, data, true);
    renderLocationMapsPreview();
    toastr.success(`${saved.length} objetivo(s) guardados en "${board.name}".`, 'Objetivos');
    return `${saved.length} objetivos`;
}

/**
 * H2: «Cómo se juega». La página se arma con el modo de esta partida, la leyenda del tablero
 * y las categorías de la crónica: no se escribe a mano, así que no se queda vieja.
 *
 * @returns {Promise<string>}
 */
export async function openHowToPlay() {
    const sections = buildHowToPlay({
        survival: survivalNow(),
        legend: getMapLegend(),
        pet: Boolean(currentPet()),
        magic: partyMembers.some(m => !m.dead && knownSpells(m).length > 0),
        // J15.4: sin conexión, cada cosa con su botón y no con su comando.
        offline: offlineGame(),
    });
    const body = $('<div class="jr-root hp-root"></div>');
    body.append($('<h3></h3>').text('Cómo se juega'));
    for (const section of sections) {
        body.append($('<div class="jr-title"></div>').attr('data-help', section.id).text(section.title));
        const list = $('<ul class="hp-lines"></ul>');
        for (const line of section.lines) list.append($('<li></li>').text(line.replace(/`/g, '')));
        body.append(list);
    }
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true, wide: true }).show();
    return '';
}

/**
 * Abre el editor de campana y guarda lo que salga.
 *
 * Escribe donde escribe el importador de libros — `metadata.locationMaps` — para que una
 * campana hecha a mano y una importada sean **la misma cosa**. Lo que este panel no ensena
 * (el terreno, las salas, los objetivos) se queda intacto: tiene sus propios editores.
 *
 * @returns {Promise<string>}
 */
export async function openCampaignBuilder() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana antes de editarla.');
        return '';
    }

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.warning(`No se pudo leer el mundo "${worldName}".`);
            return '';
        }

        const { openCampaignEditor } = await import('../game-engine/ui/campaign-editor.js');
        const { applyEditorModel, describeModel, planEntryChanges } = await import('../game-engine/campaign/campaign-editor.js');

        // El compendio, si lo hay. Sin batería de materiales no hay botón de forjar y la
        // ficha se rellena a mano, igual que siempre.
        const compendium = await campaignCompendium();

        // Un mundo de antes de que esto existiera se lleva una semilla aqui, que es el
        // primer sitio donde ya estabamos cargando y guardando su metadata. A partir de
        // ese momento es reproducible como cualquier otro.
        const seeded = ensureSeed(data.metadata ?? {});
        if (seeded.rolled) {
            data.metadata = seeded.metadata;
            await saveWorldInfo(worldName, data, true);
            console.log(`[compendio] ${describeSeed(seeded.seed)}`);
        }

        const forgeSeed = seeded.seed;
        let forged = 0;

        const edited = await openCampaignEditor({
            metadata: data.metadata ?? {},
            entries: data.entries ?? {},
            writePerson: compendium.has('personas')
                ? (/** @type {string} */ where) => writePersonFromCompendium({
                    compendium,
                    locationName: where,
                    culture: String(data.metadata?.culture || ''),
                    // De quien es ese sitio. Es lo que le da a un vecino un motivo que no
                    // es suyo, y lo que hace que valga la pena preguntarle.
                    banner: bannerOf(where, data.metadata?.factions),
                    random: createSeededRandom(derive(forgeSeed, 'persona', forged++)),
                })
                : null,
            writeQuest: compendium.has('misiones')
                ? (/** @type {string[]} */ boards) => writeFromCompendium({
                    compendium,
                    boards,
                    random: createSeededRandom(derive(forgeSeed, 'encargo', forged++)),
                })
                : null,
            breedMonster: compendium.has('bestiario')
                ? (/** @type {number} */ cr) => breedFromCompendium({
                    compendium,
                    cr: Number(cr) || 0.5,
                    // El bioma de la campana, si lo dice: el pantano no da lobos de nieve.
                    biome: biomeHere(data.metadata),
                    random: createSeededRandom(derive(forgeSeed, 'criar', forged++)),
                })
                : null,
            biomes: compendium.has('mundo')
                ? compendium.find('mundo', { kind: 'bioma' })
                    .map((/** @type {any} */ row) => String(row.biome || '')).filter(Boolean)
                : [],
            forgeItem: compendium.has('materiales')
                // Con la semilla del mundo y el número de forja: el mismo mundo propone las
                // mismas cosas en el mismo orden, y cada martillazo saca una distinta.
                ? () => forgeFromCompendium({
                    compendium,
                    random: createSeededRandom(derive(forgeSeed, 'forja', forged++)),
                })
                : null,
            Popup,
            POPUP_TYPE,
        });
        if (!edited) return '';

        data.metadata = applyEditorModel(data.metadata ?? {}, edited);
        setWorldItemCatalogue(Array.isArray(data.metadata.itemCatalogue) ? data.metadata.itemCatalogue : []);

        // Las fichas del Lorebook: lo que se escribe aqui es exactamente lo que escribe el
        // importador de libros, que es la regla que evita tener dos medias campanas.
        const plan = planEntryChanges(data.entries ?? {}, edited);
        data.entries = data.entries ?? {};

        for (const spec of plan.update) {
            const entry = data.entries[spec.uid];
            if (!entry) continue;
            writeEntrySpec(entry, spec);
        }
        for (const spec of plan.create) {
            const entry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
            if (!entry) continue;
            writeEntrySpec(entry, spec);
        }
        for (const uid of plan.remove) delete data.entries[uid];

        await saveWorldInfo(worldName, data, true);

        // El grupo se pone al dia sin rehacerse: quien ya jugaba conserva su vida, su oro
        // y su mochila, que no son cosa de este editor.
        // J1.6: los tuyos que se quedan en el gremio tienen ficha, pero no van en el grupo.
        const resting = restingUids(data.metadata?.[HUB_HEROES_KEY]);
        syncPartyWithEntries(Object.fromEntries(Object.entries(data.entries).filter(([uid]) => !resting.has(Number(uid)))), worldName);
        deliverGifts(edited.gifts, worldItemCatalogue);

        // La localidad abierta puede haberse quedado sin existir: mejor volver al selector
        // que dejar la pantalla apuntando a un sitio borrado.
        const places = (data.metadata.locationMaps ?? []).map((/** @type {any} */ l) => String(l.name));
        if (currentLocationName && !places.includes(currentLocationName)) {
            setCurrentLocationName('');
            setCurrentBoardName('');
            saveCurrentLocation();
            saveCurrentBoard();
        }

        renderLocationMapsPreview();
        toastr.success(describeModel(edited), `"${worldName}" guardado`);
        return describeModel(edited);
    } catch (error) {
        console.error('[party] campaign editor failed', error);
        toastr.error(String(error?.message || error), 'No se pudo guardar la campana');
        return '';
    }
}

/**
 * Vuelca una ficha planeada sobre una entrada del Lorebook.
 *
 * @param {any} entry
 * @param {{title: string, keys: string[], content: string, group: string, dndData: any}} spec
 */
function writeEntrySpec(entry, spec) {
    entry.comment = spec.title;
    entry.key = spec.keys;
    entry.content = spec.content;
    entry.group = spec.group;
    entry.dndData = spec.dndData;
}

/**
 * Reparte lo que el editor dijo de regalar.
 *
 * @param {Array<{item: string, to: string}>|undefined} gifts
 * @param {any[]} catalogue
 */
function deliverGifts(gifts, catalogue) {
    for (const gift of Array.isArray(gifts) ? gifts : []) {
        const holder = partyMembers.find(member => member.name === gift.to);
        const declared = catalogue.find(item => String(item?.name ?? '') === gift.item);
        if (!holder) {
            toastr.warning(`"${gift.to}" ya no esta en el grupo: "${gift.item}" no se ha repartido.`);
            continue;
        }

        const item = createItem(/** @type {any} */ (
            describeLootItem(gift.item, String(declared?.rarity ?? ''), catalogue)));
        addItemToInventory(/** @type {any} */ (holder), item);
        toastr.success(`${holder.name} lleva ahora "${gift.item}".`);
    }

    if (Array.isArray(gifts) && gifts.length > 0) savePartyState();
}

/**
 * Abre los ajustes de sonido, cargando el panel solo cuando hace falta.
 *
 * @returns {Promise<string>}
 */
export async function openAudioSettings() {
    const { openAudioSettings: open } = await import('../game-engine/ui/audio-settings.js');
    return await open({ Popup, POPUP_TYPE });
}

/**
 * Empaqueta la campana abierta y la descarga.
 *
 * Sale por el mismo formato que entra: el paquete se normaliza y se valida con el mismo
 * validador que juzga los libros de fuera, asi que lo que se descarga aqui se puede
 * importar alli. Si el validador encuentra algo, se dice **antes** de que el archivo
 * acabe en manos de otro.
 *
 * @returns {Promise<string>}
 */
export async function exportCampaignPack() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('No hay ninguna campana abierta que exportar.');
        return '';
    }

    const data = await loadWorldInfo(worldName);
    if (!data) {
        toastr.warning(`No se pudo leer el mundo "${worldName}".`);
        return '';
    }

    const built = buildPackFromWorld({
        worldName,
        metadata: data.metadata ?? {},
        entries: data.entries ?? {},
        synopsis: String(data.metadata?.synopsis ?? ''),
    });

    const { pack, repairs } = normalizePack(built);
    const report = validatePack(pack);

    const fileName = `${worldName.toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'campana'}.campaign.json`;
    download(JSON.stringify(pack, null, 2), fileName, 'application/json');

    const summary = describeExport(pack);
    if (report.ok) {
        toastr.success(summary, 'Campana exportada', { timeOut: 8000 });
    } else {
        // Se descarga igual — son tus datos — pero nadie deberia enterarse de que el
        // archivo no vale al intentar importarlo en casa de otro.
        toastr.warning(
            `${summary}. El validador encuentra ${report.errors.length} problema(s): `
            + report.errors.slice(0, 3).map(e => e.message).join(' · '),
            'Exportada, pero con avisos', { timeOut: 15000 },
        );
    }
    if (repairs.length > 0) console.info('[party] exportando:', repairs);

    postCombatNarration(`📦 [CAMPANA] Exportada: ${summary}.`);
    return fileName;
}

/**
 * Idea 199: el salón de la fama. Los caídos de todas las partidas, el más reciente arriba.
 */
export function openHallOfFame() {
    // J14.10: con el romance apagado, las parejas no salen.
    const hall = hallShown(/** @type {any} */ (extension_settings).partyHall);
    const body = $('<div class="jr-root hall-root"></div>');
    body.append($('<h3></h3>').text('Salón de la fama'));
    // J3.9: arriba, las campañas terminadas; J14.10, las parejas; debajo, los caídos.
    const done = hall.filter(entry => entry.kind === 'campaign');
    const couples = hall.filter(entry => entry.kind === 'couple');
    const fallen = hall.filter(entry => !entry.kind);
    if (done.length > 0) {
        body.append($('<h4 class="hall-head"></h4>').text('Campañas terminadas'));
        for (const entry of done) body.append($('<div class="jr-item hall-entry hall-campaign"></div>').text(describeHallEntry(entry)));
    }
    if (couples.length > 0) {
        body.append($('<h4 class="hall-head"></h4>').text('Parejas'));
        for (const entry of couples) body.append($('<div class="jr-item hall-entry hall-couple"></div>').text(describeHallEntry(entry)));
    }
    if (done.length > 0 || couples.length > 0) body.append($('<h4 class="hall-head"></h4>').text('Los caídos'));
    if (fallen.length === 0) body.append($('<div class="jr-item"></div>').text('Todavía no ha caído nadie.'));
    for (const entry of fallen) body.append($('<div class="jr-item hall-entry"></div>').text(describeHallEntry(entry)));
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Idea 181: ¿llega este mundo al listón? El mismo informe que la herramienta de consola,
 * sobre el mundo abierto, con el encargo para el Gem listo para copiar.
 *
 * @returns {Promise<string>}
 */
export async function checkCurrentWorld() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName) : null;
    if (!data) {
        toastr.warning('Abre una campaña para comprobar su mundo.');
        return '';
    }
    const built = buildPackFromWorld({
        worldName, metadata: data.metadata ?? {}, entries: data.entries ?? {}, synopsis: String(data.metadata?.synopsis ?? ''),
    });
    const { pack } = normalizePack(built);
    // Lo que el paquete exportado no lleva y el comprobador mira: la gente del mundo, los
    // encargos escritos, los rumores y el hilo.
    const npcs = Object.values(data.entries ?? {})
        .filter((/** @type {any} */ e) => e?.dndData?.entityType === 'npc')
        .map((/** @type {any} */ e) => ({
            name: String(e.dndData.name || e.comment || ''),
            where: String(e.dndData.mapPosition?.locationName || ''),
            wants: String(e.dndData.wants || ''),
            knows: String(e.dndData.knows || ''),
            // J10: lo que esconde (un secreto del sitio) y lo que atiende (gente o servicios).
            secret: String(e.dndData.secret || ''),
            service: String(e.dndData.service || ''),
        }));
    const report = checkWorldDensity({
        ...pack,
        npcs,
        plot: data.metadata?.plot ?? /** @type {any} */ (pack).plot,
        contracts: data.metadata?.writtenContracts ?? [],
        rumors: data.metadata?.rumors ?? [],
    });
    const body = $('<div class="jr-root wd-root"></div>');
    body.append($('<h3></h3>').text(`¿Llega al listón? ${report.ok ? 'Sí' : `${report.errors.length} cosa(s) por arreglar`}`));
    for (const line of report.counts) body.append($('<div class="jr-item wd-count"></div>').text(line));
    if (report.errors.length > 0) body.append($('<div class="jr-title"></div>').text('Por arreglar'));
    for (const line of report.errors.slice(0, 20)) body.append($('<div class="jr-item wd-error"></div>').text(line));
    if (report.warnings.length > 0) body.append($('<div class="jr-title"></div>').text('Conviene mirar'));
    for (const line of report.warnings.slice(0, 20)) body.append($('<div class="jr-item wd-warning"></div>').text(line));
    const request = gemRequest(report);
    const result = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        allowVerticalScrolling: true,
        leftAlign: true,
        customButtons: request ? [{ text: 'Copiar el encargo para el Gem', result: 71, classes: ['wd-copy'] }] : [],
    }).show();
    if (result === 71 && request) {
        await navigator.clipboard?.writeText(request).catch(() => {});
        toastr.success('El encargo está copiado: pégalo en el Gem.', 'Copiado');
    }
    return report.ok ? 'llega' : `${report.errors.length} por arreglar`;
}

/**
 * El compendio: la biblioteca de contenido de la que tiran los generadores.
 *
 * No hace falta tener una partida abierta, y por eso vive en el menu de titulo: el
 * compendio es **tuyo**, no de una campana. Lo que se ve es que baterias hay, cuantas
 * filas traen, **cuales faltan** y que sale si lo pides con una semilla.
 *
 * @returns {Promise<void>}
 */
export async function openCompendiumLibrary() {
    const { compendium, errors } = await getCompendium();
    const { openCompendiumPanel } = await import('../game-engine/ui/compendio-panel.js');

    // Un vocabulario cerrado mal escrito pasa la validacion de toda fila y luego no hace
    // lo que dice. Se cuenta aqui, junto a lo que no se pudo leer.
    const broken = [
        ...validateAbilities(compendium),
        ...validateFactionRows(compendium),
        ...validateKin(compendium),
    ];

    await openCompendiumPanel({
        compendium,
        errors: [...errors, ...broken],
        // Probar es lo que hace util la pantalla: diez tiradas con tu semilla, sin jugarte
        // una partida entera para descubrir que la daga sale siempre. Cada bateria se
        // prueba con quien la sortea de verdad, no con una lista de nombres.
        sample: (domain, seed, howMany) => {
            const random = createSeededRandom(derive(seed, 'probar', domain));

            if (domain === 'nombres') {
                return makeNames({ compendium, howMany, random });
            }
            if (domain === 'materiales' || domain === 'trastos') {
                return forgeItems({ compendium, howMany, random }).map(describeItem);
            }
            if (domain === 'armas' || domain === 'armaduras') {
                // Del tipo que toca: una pestaña de armas que ensena faroles no dice si
                // la bateria de armas esta bien.
                const itemType = domain === 'armas' ? 'weapon' : 'armor';
                return forgeItems({ compendium, howMany, random, itemType }).map(describeItem);
            }
            if (domain === 'bestiario') {
                return breedBand({ compendium, howMany, cr: 1, random }).map(describeMonster);
            }
            if (domain === 'misiones') {
                return writeQuestBoard({ compendium, howMany, random }).map(describeQuest);
            }
            if (domain === 'facciones') {
                // Se prueba repartiendolas por el mundo abierto, que es para lo que son.
                // Sin campana abierta, por un mundo de mentira: la bateria se ve igual.
                const places = getCurrentWorldLocationMaps().length >= 2
                    ? getCurrentWorldLocationMaps()
                    : [{ name: 'El Molino' }, { name: 'La Ermita' }, { name: 'Cripta olvidada' }];
                const rolled = rollFactions({
                    compendium, locations: places, random, count: howMany,
                });
                const names = namesOf(rolled);
                return rolled.map(faction => describeFaction(faction, names));
            }
            if (domain === 'razas' || domain === 'clases') {
                // Se prueban ensenando lo que dan y lo que quitan: una lista de nombres no
                // dice si elegir raza significa algo.
                const rows = domain === 'razas' ? racesOf(compendium) : kindsOf(compendium);
                return rows.slice(0, howMany).map(row => `${row.name} · ${describeKin(row)}`);
            }
            if (domain === 'habilidades') {
                // Lo que sabe hacer una clase, que es lo que la bateria hace. Una lista
                // de nombres sueltos no dice si elegir clase significa algo.
                const classes = classesOf(compendium);
                const className = classes[Math.floor(random() * classes.length) % classes.length] ?? '';
                const known = abilitiesFor({ compendium, className, level: 3 });
                return [
                    `${className || 'Cualquiera'}, a nivel 3:`,
                    ...known.map(nameAndAbility),
                ];
            }
            if (domain === 'personas') {
                // Un pueblo, no filas sueltas: lo que se quiere ver es que cada uno
                // quiere algo distinto y que el oficio no se repite.
                return writeVillage({ compendium, howMany, locationName: 'El Molino', random })
                    .flatMap((/** @type {any} */ person) => [
                        describePerson(person),
                        `   ${person.backstory}`,
                    ]);
            }
            if (domain === 'mundo') return sampleJourney(compendium, random);
            if (domain === 'sitios') return samplePlace(compendium, random);
            if (domain === 'propiedades') {
                // Solo lo que lleva propiedad: forjar sin ellas es probar la otra bateria.
                return forgeItems({ compendium, howMany, random, properties: 1 })
                    .map(describeItem);
            }

            // Lo que todavia no tiene generador se ensena **agrupado por clase**: una
            // lista que mezcla biomas, climas y sucesos no dice nada de ninguno.
            const rows = compendium.take(domain, howMany * 2, { random });
            /** @type {Map<string, string[]>} */
            const byKind = new Map();
            for (const row of rows) {
                const kind = String(row.kind || 'filas');
                if (!byKind.has(kind)) byKind.set(kind, []);
                byKind.get(kind)?.push(String(row.name));
            }
            return [...byKind.entries()].map(([kind, names]) => `${kind}: ${names.join(', ')}`);
        },
        Popup,
        POPUP_TYPE,
    });
}

/**
 * Un viaje entero, que es lo que la bateria del mundo **hace**.
 *
 * Ensenar sus filas sueltas —«Niebla, Viento, Un desprendimiento, Despejado»— no dice
 * nada de ninguna: lo que se quiere ver es que el tiempo hace rachas, que en un sitio no
 * puede nevar y que los sucesos encajan con lo que hace ese dia.
 *
 * @param {any} compendium
 * @param {() => number} random
 * @returns {string[]}
 */
function sampleJourney(compendium, random) {
    const biome = compendium.pick('mundo', { where: { kind: 'bioma' }, random });
    if (!biome) return [];

    const days = 6;
    const weather = rollWeather({
        days,
        table: compendium.find('mundo', { kind: 'clima' }),
        climates: biome.climates ?? [],
        random,
    });
    const events = travelEvents({
        days,
        table: compendium.find('mundo', { kind: 'suceso' }),
        biome: String(biome.biome || ''),
        weather,
        random,
    });

    const lines = [`Seis días por ${String(biome.name).toLowerCase()}: ${weather.join(' · ')}`];
    for (const event of events) {
        const cost = event.days > 0 ? ` (+${event.days} día)`
            : (event.days < 0 ? ` (−${-event.days} día)` : '');
        lines.push(`Día ${event.day} · ${event.name}${cost} — ${event.note}`);
    }
    if (events.length === 0) lines.push('Seis días sin nada que contar. También pasa.');

    return lines;
}

/**
 * Un sitio entero, dibujado.
 *
 * La bateria de sitios no es una lista de nombres: es de que forma es un sitio, que salas
 * escritas a mano lleva dentro y en que estado esta. Eso solo se ve mirando el mapa.
 *
 * @param {any} compendium
 * @param {() => number} random
 * @returns {string[]}
 */
function samplePlace(compendium, random) {
    const type = compendium.pick('sitios', { where: { kind: 'tipo' }, random });
    const state = compendium.pick('sitios', { where: { kind: 'estado' }, random });
    if (!type) return [];

    const board = generateBoard({
        random,
        size: 'small',
        shape: String(type.shape || 'rooms'),
        templates: compendium.find('sitios', { kind: 'sala' })
            .map((/** @type {any} */ row) => row.rows),
        state: state ? { cover: state.cover, rough: state.rough } : null,
        partySize: 2,
        bestiary: ['Lobo'],
    });

    return [
        `${type.name}${state ? ` · ${state.name}` : ''} · forma "${type.shape}"`,
        ...board.map,
    ];
}

/**
 * Las reglas de la campana abierta.
 *
 * Extraido de `/rules` porque el menu de pausa abre lo mismo. Una segunda copia seria
 * un segundo sitio donde olvidarse de volver a aplicar el paquete despues de guardarlo.
 *
 * @returns {Promise<string>}
 */
export async function openRules() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana primero.');
        return '';
    }

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.error(`No se pudo cargar el mundo "${worldName}".`);
            return '';
        }

        const { openRulesEditor } = await import('../game-engine/ui/rules-editor.js');
        const edited = await openRulesEditor({
            pack: data.metadata?.rulesetPack ?? null,
            title: `Reglas de "${worldName}"`,
            Popup,
            POPUP_TYPE,
        });
        if (!edited) return '';

        // Quitar un valor que algo ya usa deja una referencia muerta, y hasta ahora se
        // guardaba sin protestar: la espada seguia apuntando a un tipo de dano que ya no
        // existia y solo se notaba tres sesiones despues. No se impide el cambio -es tu
        // campana- pero se decide con la factura delante.
        const { findBrokenReferences, describeImpact } = await import('../game-engine/rules/rule-impact.js');
        const broken = findBrokenReferences({
            before: data.metadata?.rulesetPack ?? null,
            after: edited,
            items: partyMembers.flatMap(m => (Array.isArray(m.items) ? m.items : [])),
            characters: partyMembers,
        });

        if (broken.length > 0) {
            // El texto del dialogo es HTML, asi que las lineas van con <br>.
            const detail = broken.map(b => `• ${escapeHtml(b.message)}`).join('<br>');
            const go = await Popup.show.confirm(
                'Este cambio rompe referencias',
                `${escapeHtml(describeImpact(broken))}<br><br>${detail}<br><br>¿Guardar de todas formas?`,
            );
            if (!go) {
                toastr.info('No se ha guardado nada.');
                return '';
            }
        }

        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = edited;
        await saveWorldInfo(worldName, data, true);

        await applyCampaignRuleset(worldName);
        return 'reglas guardadas';
    } catch (error) {
        console.error('[party] rules editor failed', error);
        toastr.error(String(error?.message || error), 'No se pudieron editar las reglas');
        return '';
    }
}
