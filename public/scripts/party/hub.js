/**
 * El gremio de «Jugar sin conexión» (J4): la casa, sus edificios y su almacén, el tablón de
 * campañas, contratar, el banquillo, retirarse, y la vuelta tras un final.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata, setUserName, saveSettingsDebounced } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { getCurrentWorldLocationMaps, loadWorldInfo, METADATA_KEY } from '../world-info.js';
import { migratePartyMember } from '../dnd-system.js';
import { escapeHtml } from '../utils.js';
import { campaignHallEntry, hallCampaignName } from '../game-engine/campaign/campaign-end.js';
import { readBench, benchMember, callFromBench, whereHired } from '../game-engine/campaign/bench.js';
import { store, retrieve, readStorage } from '../game-engine/campaign/storage.js';
import { guestMember, HIRELINGS, MERCENARY_FEE } from '../game-engine/campaign/guests.js';
import {
    isHubWorld, hubCampaignCards, hireOffers, hubRoster, hubTrial, HUB_CONTRACT, HUB_BOARD_NAME_KEY, readHub,
} from '../game-engine/campaign/hub.js';
import { HUB_CHRONICLES_KEY, readChronicles } from '../game-engine/campaign/story-book.js';
import { HUB_HEROES_KEY, hubHeroCards, readRestingHeroes, seatHero, swapLine } from '../game-engine/campaign/hub-heroes.js';
import { isIronRun, modeOf, modeLabel } from '../game-engine/rules/modes.js';
import { readGraves, addToHall } from '../game-engine/campaign/legacy.js';
import { hallShown } from './romance.js';
import { retireTo, upgradeCost, describeGuild } from '../game-engine/campaign/guild.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { HALL_CHIPS } from '../game-engine/campaign/guild-hall.js';
export { HALL_SECTIONS, hallDetail } from '../game-engine/campaign/guild-hall.js';
import { chestView, takeFromChest, putInChest, depositGold, withdrawGold, payPlan, spendFromChest } from '../game-engine/campaign/guild-chest.js';
export { putInChest, depositGold, withdrawGold, payPlan, spendFromChest } from '../game-engine/campaign/guild-chest.js';
import {
    houseView, buildInGuild, forgeOffers, forgeItem, libraryOffers, learnSpell, recruitArrival, guildHirelings, journeyWithStable,
} from '../game-engine/campaign/guild-buildings.js';
export { buildingOpens, forgeOffers, forgeItem, libraryOffers, learnSpell } from '../game-engine/campaign/guild-buildings.js';
import { trainSession, trainingView } from '../game-engine/campaign/guild-training.js';
export { trainees, GUILD_TRAINING_FACTOR } from '../game-engine/campaign/guild-training.js';
import { errandCards, errandReveal, errandAcceptLine } from '../game-engine/campaign/guild-errands.js';
export { routeDays } from '../game-engine/campaign/guild-errands.js';
import { guildRank, hubRenown, lockCampaignCards, rankNews } from '../game-engine/campaign/guild-rank.js';
export { GUILD_RANKS } from '../game-engine/campaign/guild-rank.js';
export { campaignCompanions, stayVerdict, stayScene } from '../game-engine/campaign/guild-companions.js';
import { GUILD_MEMORY_KEY, guildMemoryOf, offeredCampaigns } from '../game-engine/campaign/guild-memory.js';
export { describeGuildMemory, guildMemoryOf, guildTitle } from '../game-engine/campaign/guild-memory.js';
import { WORLD_MARKS_KEY } from '../game-engine/campaign/world-marks.js';
export { describeMarks } from '../game-engine/campaign/world-marks.js';
import { openMemoryPanel } from '../game-engine/ui/memory-panel.js';
export { memoryPanelModel } from '../game-engine/ui/memory-panel.js';
import { getCompendium } from '../game-engine/compendio/browser.js';
import { sortByTier, tierBoardLine } from '../game-engine/campaign/level-tiers.js';
import { canRetireNow, withHireReasons, weeklyHireOffers } from './long-life.js';
import { recruitPatch } from '../game-engine/campaign/weekly-mercenaries.js';
import { drawGuildPrep, drawGuildBooks, restHallLine } from './guild-pay.js';
import { canDispatch } from '../game-engine/campaign/dispatch.js';
import { BENCH_KEY, BOARD_KEY, GRAVES_KEY, GUILD_KEY, MODE_HISTORY_KEY, PLOT_STATE_KEY, STORAGE_KEY, TAKEN_KEY } from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCurrentBoardName, setPartyMembers,
} from './state.js';
import { acceptContract, getGuild, refreshContractBoard } from './contracts.js';
import { instancesFromPlacements } from './combat-flow.js';
import { awardEncounterLoot } from './loot.js';
import { recordBoardWon } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { ensureWorldData, lastHub, lastHubHome, saveCurrentBoard } from './world.js';
import { getCurrentWorldFactions } from './factions.js';
import { getCampaignCalendar, campaignDay, advanceCampaignDay, markLocationComplete, spendDayPart, takeRest } from './time.js';
import { getPlot, notePlot, plotEndingTitle, revealLocations } from './plot.js';
import { noteDeed } from './world-growth.js';
import { survivalNow } from './modes.js';
import { postCombatNarration, postForModel } from './narration.js';
import { savePartyState, renderPartyMembers, partyPurse, payFromParty } from './roster.js';
import { countStat } from './menus.js';
import { getXpTable, openLevelUpCard } from './level-up.js';
import { carryBondOf } from './social.js';
import { classRowOf, spellRows } from './magic.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */

/**
 * J4.5: la vuelta al gremio tras un final, contada. Lo lee el modelo y lo ve quien juega.
 *
 * @param {string} scene La de `homecomingScene`.
 * @returns {Promise<void>}
 */
export async function postHomecoming(scene) {
    if (!String(scene ?? '').trim()) return;
    await postForModel(`[GREMIO] ${String(scene).trim()} Cuéntalo en dos o tres frases, en el tono de la campaña. No inventes nada que no esté aquí.`);
}

/**
 * J3.9: la campaña abierta, si ha llegado a su final, entra en el salón de la fama. Apuntarla
 * otra vez (al volver al gremio) no la repite.
 *
 * @returns {import('../game-engine/campaign/legacy.js').HallEntry|null} Lo apuntado: quién fue y quién cayó.
 */
export function recordFinishedCampaign() {
    const title = plotEndingTitle();
    if (!title || !chat_metadata) return null;
    const plot = getPlot();
    const world = String(chat_metadata?.[METADATA_KEY] ?? '');
    const settings = /** @type {any} */ (extension_settings);
    const entry = campaignHallEntry({
        // D-J19: como en el tablón; si no salió de él, como su hilo escrito o como su mundo.
        campaign: hallCampaignName({ board: chat_metadata?.[HUB_BOARD_NAME_KEY], plot, world }),
        world,
        ending: title,
        party: partyMembers,
        graves: readGraves(chat_metadata?.[GRAVES_KEY]),
        day: campaignDay(),
        when: new Date().toISOString(),
        mode: modeLabel(modeOf(survivalNow())),
        iron: isIronRun(survivalNow(), chat_metadata?.[MODE_HISTORY_KEY] ?? null),
    });
    settings.partyHall = addToHall(settings.partyHall, entry);
    saveSettingsDebounced();
    return entry;
}

/**
 * Abre el gremio: el tablon, la casa y quien esta.
 *
 * @returns {Promise<string>}
 */
export async function openGuild() {
    await ensureWorldData();
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana antes de mirar el tablon.');
        return '';
    }

    const guild = getGuild();
    const board = refreshContractBoard();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const purse = partyMembers.reduce((sum, m) => sum + Math.max(0, Number(m.gold) || 0), 0);


    const { openGuildPanel } = await import('../game-engine/ui/guild-panel.js');
    const choice = await openGuildPanel({
        guild, board, day: today, purse, roster: partyMembers, Popup, POPUP_TYPE,
        // Idea 42: quien está en casa, y si cabe alguien más en el grupo.
        bench: readBench(chat_metadata?.[BENCH_KEY]),
        partyFull: whereHired(partyMembers) === 'bench',
        // Idea 124: lo que hay en el almacén y lo que se puede dejar.
        storage: readStorage(chat_metadata?.[STORAGE_KEY]),
        carried: partyMembers.filter(m => !m.dead).flatMap(m => (m.items ?? [])
            .filter((/** @type {any} */ i) => !Object.values(m.equippedItems ?? {}).includes(i.id) && !i.cursed)
            .map((/** @type {any} */ i) => ({ memberId: String(m.id), memberName: String(m.name), itemId: String(i.id), name: String(i.name) }))),
        fighting: combatEncounter.active,
        // J3.1: la barra de las partes de la sala, solo en el gremio (en otro pueblo no están).
        rooms: Boolean(lastHub),
        // Para que el tablon pueda decir a quien ayudas o a quien paras por su nombre.
        factionNames: Object.fromEntries(
            getCurrentWorldFactions().map((/** @type {any} */ f) => [f.id, f.name]),
        ),
    });
    if (!choice) return describeGuild(guild);

    if (choice.built) return raiseBuilding(choice.built, purse);
    if (choice.accepted) return await acceptContract(choice.accepted);
    if (choice.benched) return rotateBench('bench', choice.benched);
    if (choice.called) return rotateBench('call', choice.called);
    if (choice.stored || choice.retrieved) return useStorage(choice.stored, choice.retrieved);
    if (choice.room) {
        if (choice.room === 'chest') return await openGuildChest();
        if (choice.room === 'training') return await openGuildTraining();
        if (choice.room === 'house') return await openGuildHouse();
        if (choice.room === 'errands') return await openGuildErrands();
        if (choice.room === 'heroes') return await openHubHeroes();
        if (choice.room === 'memory') {
            await openMemoryView();
            return '';
        }
    }
    return '';
}

/**
 * Idea 124: guardar algo en el almacén del gremio, o sacarlo para el héroe.
 *
 * @param {string} stored `memberId:itemId`
 * @param {string} retrieved `itemId`
 * @returns {string}
 */
function useStorage(stored, retrieved) {
    if (!chat_metadata) return '';
    const [memberId, itemId] = String(stored || '').split(':');
    const member = stored ? partyMembers.find(m => String(m.id) === memberId) : partyMembers[0];
    if (!member) return '';
    const result = stored ? store(member, chat_metadata[STORAGE_KEY], itemId) : retrieve(member, chat_metadata[STORAGE_KEY], retrieved);
    if (!result.ok) {
        toastr.warning(result.reason, 'El almacén');
        return '';
    }
    member.items = result.items;
    chat_metadata[STORAGE_KEY] = result.storage;
    savePartyState();
    saveMetadata();
    renderPartyMembers();
    postCombatNarration(`📦 [GREMIO] ${result.line}`);
    toastr.success(result.line, 'El almacén');
    return result.line;
}

/**
 * J4: lo que el gremio ofrece en la fila de fichas. En combate, nada.
 *
 * @returns {Array<{id: string, label: string, icon: string, command: string}>}
 */
export function hubChips() {
    if (combatEncounter.active) return [];
    if (lastHub) {
        const trial = hubTrial(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
        return [
            // J2.3: la prueba se puede saltar mientras está por hacer. Va junto a la de pelearla.
            ...(trial ? [{ id: 'hub-skip', label: 'Saltar la prueba', icon: 'fa-forward', command: '/saltar-prueba' }] : []),
            // D-J28: el tablón y los mercenarios, escondidos hasta que acabe la prueba: primero
            // se llega, se conoce a Brunilda y se baja a la bodega.
            ...(trial ? [] : [
                { id: 'hub-board', label: 'Tablón de campañas', icon: 'fa-scroll', command: '/campanas' },
                { id: 'hub-hire', label: 'Contratar mercenarios', icon: 'fa-coins', command: '/contratar' },
            ]),
            // J3.9: el salón de la fama, en cuanto hay alguien (o alguna campaña) en él.
            // J14.10: con el romance apagado, las parejas no cuentan.
            ...(hallShown(/** @type {any} */ (extension_settings).partyHall).length > 0
                ? [{ id: 'hub-hall', label: 'Salón de la fama', icon: 'fa-monument', command: '/salon' }] : []),
            // J3.1: las partes de la sala (encargos, tus personajes, el cofre, el patio, los
            // edificios) y J11.4, lo que recuerda el gremio. Detrás de las de siempre: la fila de
            // abajo solo lleva las cuatro primeras, y el salón no debe quedarse fuera. En el
            // prólogo, nada de esto (D-J28): solo «Saltar la prueba».
            ...(trial ? [] : [
                ...HALL_CHIPS,
                // E8.3: un héroe de nivel 5 o más puede quedarse de maestro.
                ...(canRetireNow() ? [{ id: 'hub-retire', label: 'Retirarse al gremio', icon: 'fa-graduation-cap', command: '/retirarse' }] : []),
                { id: 'hub-memory', label: 'Memoria del gremio', icon: 'fa-book-skull', command: '/memoria' },
                // J3.3: dormir en las camas de la casa cura, amanece y guarda la partida (J15.2).
                { id: 'hub-sleep', label: 'Dormir en el gremio', icon: 'fa-bed', command: '' },
            ]),
        ];
    }
    if (lastHubHome) {
        return [
            // J4.5: con la campaña terminada, su final se puede volver a ver.
            ...(chat_metadata?.plotEnding ? [{ id: 'hub-ending', label: 'El final', icon: 'fa-flag-checkered', command: '/final' }] : []),
            { id: 'hub-home', label: 'Volver al gremio', icon: 'fa-house-flag', command: '/volver-gremio' },
            { id: 'hub-memory', label: 'Lo que se recuerda', icon: 'fa-book-skull', command: '/memoria' },
        ];
    }
    return [];
}

/**
 * J2.3: saltar la prueba del gremio, para quien ya sabe jugar o trae su segundo personaje.
 *
 * Cuenta como ganada, por los mismos caminos que la pelea: el botín y la experiencia de los
 * enemigos que el tablero traía escritos (saltarla no castiga), el tablero ganado (sus ratas
 * no vuelven a salir), el sitio superado y el hilo, que recibe la victoria, abre el hito
 * siguiente y cuenta su escena. El personaje ya está hecho: la ficha sale después.
 *
 * @returns {Promise<string>} El hito saltado, o vacío.
 */
export async function skipHubTrial() {
    const trial = lastHub && partyMembers.length > 0 ? hubTrial(getPlot(), chat_metadata?.[PLOT_STATE_KEY]) : null;
    if (!trial) {
        toastr.info('Aquí no hay ninguna prueba que saltar.', 'La prueba');
        return '';
    }
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    const go = await Popup.show.confirm('¿Saltar la prueba?',
        `«${escapeHtml(trial.title)}» se da por hecha, como si hubieras ganado en ${escapeHtml(trial.board)}: sin pelear, y con lo que te habrías llevado. Es para quien ya sabe jugar.`,
        { okButton: 'Saltarla', cancelButton: 'Mejor la juego' });
    // Mientras se decidía, la prueba ha podido hacerse (o empezar la pelea).
    if (!go || combatEncounter.active || !hubTrial(getPlot(), chat_metadata?.[PLOT_STATE_KEY])) return '';

    const same = (/** @type {any} */ a, /** @type {string} */ b) => String(a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
    const locations = getCurrentWorldLocationMaps();
    /** @param {string} name @returns {any} La localización que tiene ese tablero. */
    const homeOf = (name) => locations.find((/** @type {any} */ l) => (l?.boards ?? []).some((/** @type {any} */ b) => same(b?.name, name)));
    const place = trial.place || String(homeOf(trial.board)?.name ?? '') || currentLocationName;
    postCombatNarration(`⏭️ [HILO] Te saltas «${trial.title}»: cuenta como hecha.`);
    // J2.1: lo mismo que deja ganar cada pelea de la prueba (el muelle y la bodega): el botín de
    // los que esperaban, en uno, cada tablero ganado y sus enemigos, vencidos para el hilo.
    const boards = trial.boards?.length > 0 ? trial.boards : [{ board: trial.board, place }];
    /** @type {any[]} */
    const defeated = [];
    for (const step of boards) {
        const home = homeOf(step.board);
        const where = step.place || String(home?.name ?? '') || place;
        const board = (home?.boards ?? []).find((/** @type {any} */ b) => same(b?.name, step.board));
        const fallen = instancesFromPlacements(Array.isArray(board?.enemyPlacements) ? board.enemyPlacements : []);
        defeated.push(...fallen);
        recordBoardWon(where, step.board);
        for (const name of new Set(fallen.map(e => String(e.name).replace(/\s+\d+$/, '')))) {
            notePlot({ kind: 'defeat', enemy: name });
        }
    }
    const loot = awardEncounterLoot(defeated);
    if (loot?.gold) countStat('gold', loot.gold);
    markLocationComplete(place);
    // Si se estaba en uno de sus tableros (el muelle), se sale: ya no queda nadie a quien pegar.
    if (currentBoardName) {
        setCurrentBoardName('');
        saveCurrentBoard();
    }
    notePlot({ kind: 'win', place, board: trial.board });
    renderPartyMembers();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    return trial.id;
}

/**
 * J3.7: las campañas del tablón (las de `mundos.json` y las añadidas por ti), leídas la última
 * vez que se miró: lo que da cada una terminada sale de su nivel, y el rango abre las que piden
 * más. La sala las usa sin volver a leerlas.
 *
 * @type {{world: string, rows: any[]}}
 */
let boardRows = { world: '', rows: [] };
/** Si se están leyendo: la sala se dibuja cada poco y no hay que pedirlas dos veces. */
let boardRowsLoading = false;

/**
 * Leer las campañas del tablón de un gremio, y quedárselas para la sala.
 *
 * @param {string} worldName
 * @returns {Promise<{worlds: any[], imported: any[]}>}
 */
async function readBoardRows(worldName) {
    const worlds = await fetch('/mundos/mundos.json', { cache: 'no-cache' })
        .then(response => response.json())
        .then(json => (Array.isArray(json?.worlds) ? json.worlds : []))
        .catch(() => []);
    const { loadImportedCampaigns } = await import('../campaigns.js');
    const imported = await loadImportedCampaigns(worldName).catch(() => []);
    boardRows = { world: worldName, rows: [...worlds, ...imported] };
    return { worlds, imported };
}

/**
 * Las campañas del tablón de este gremio, si ya se leyeron. Si no, se piden y la sala se vuelve
 * a dibujar al llegar: mientras, sin ellas (el renombre, como el de una campaña sin nivel).
 *
 * @returns {any[]}
 */
function knownBoardRows() {
    const world = String(chat_metadata?.[METADATA_KEY] || '');
    if (world && lastHub && boardRows.world !== world && !boardRowsLoading) {
        boardRowsLoading = true;
        void readBoardRows(world)
            .catch(error => console.warn('[gremio] no se leyó el tablón', error))
            .finally(() => {
                boardRowsLoading = false;
                if (isShellOpen()) refreshGameShell();
            });
    }
    return boardRows.world === world ? boardRows.rows : [];
}

/**
 * J4: el tablón de campañas del gremio. Elegir una la empieza o la sigue.
 *
 * @returns {Promise<string>}
 */
export async function openHubCampaigns() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName).catch(() => null) : null;
    if (!isHubWorld(data?.metadata)) {
        toastr.info('El tablón de campañas está en el gremio.', 'Campañas');
        return '';
    }
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    // D-J35: las que has añadido tú salen en todos tus gremios: son de tu lista, no del gremio.
    const { worlds, imported } = await readBoardRows(worldName);
    // J3.7: el renombre del gremio, con lo que da cada campaña terminada por su nivel.
    const { renown } = hubRenown({ guild: getGuild(), hub: data?.metadata?.hub, worlds: boardRows.rows });
    // E8.1: el nivel de quien va decide qué tramo sale delante.
    const leadLevel = Number(partyMembers.find(m => !m.guest)?.level) || 1;
    // J11.4: lo que el gremio recuerda decide qué se ofrece (y por qué, delante). J3.7: y las
    // que el rango aún no abre salen cerradas, con lo que falta. E8.1: las de tu tramo, primero.
    const cards = sortByTier(lockCampaignCards(offeredCampaigns({
        // J3.6: con el establo del gremio, «A siete días de camino» en vez de nueve.
        cards: hubCampaignCards({
            worlds: worlds.map(row => journeyWithStable(row, getGuild(), partyMembers.length)),
            hub: data?.metadata?.hub,
            imported: imported.map(row => journeyWithStable(row, getGuild(), partyMembers.length)),
            level: Number(partyMembers.find(m => !m.guest)?.level) || 1,
        }),
        memory: guildMemoryOf({ memory: data?.metadata?.[GUILD_MEMORY_KEY], hub: readHub(data?.metadata?.hub) }),
        worlds: [...worlds, ...imported],
    }), { renown, worlds: boardRows.rows }), leadLevel);
    // J1.6: arriba, quién va; tus personajes del gremio, para cambiarlo antes de salir.
    const heroes = hubHeroCards({ party: partyMembers, resting: data?.metadata?.[HUB_HEROES_KEY] });
    const { openHubBoard } = await import('../game-engine/ui/hub-panel.js');
    // J11.5: la crónica de cada campaña empezada, guardada al volver de ella.
    const picked = await openHubBoard({
        Popup, POPUP_TYPE, cards, heroes, chronicles: readChronicles(data?.metadata?.[HUB_CHRONICLES_KEY]),
        tierNote: tierBoardLine(leadLevel),
        // J3.7: una añadida ahora mismo, con lo que pide su nivel de entrada.
        lock: (card) => lockCampaignCards([card], { renown, worlds: [{ id: card.id, levels: [card.minLevel, card.minLevel] }] })[0],
    });
    if (!picked) return '';
    if (typeof picked !== 'string') {
        const { changeHubHero } = await import('../campaigns.js');
        const changed = await changeHubHero(picked);
        // Con otro al frente, el tablón otra vez: ahora se elige adónde va.
        return changed && 'hero' in picked ? await openHubCampaigns() : '';
    }
    const { playHubCampaign } = await import('../campaigns.js');
    await playHubCampaign(picked);
    return '';
}

/**
 * J4: contratar o despedir a los mercenarios del gremio. Se quedan hasta que los despides o
 * caen; no se van al acabar un encargo.
 *
 * @returns {Promise<string>}
 */
export async function openHubHire() {
    if (!lastHub) {
        toastr.info('Los mercenarios se contratan en el gremio.', 'Contratar');
        return '';
    }
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    const { openHirePanel } = await import('../game-engine/ui/hub-panel.js');
    // J3.6: con camas en los dormitorios se quedan más espadas de alquiler (`guildHirelings`).
    // E8.5: con por qué llevarles (riesgo, que siempre están, su oficio y lo que cuestan); E8.3,
    // con la rebaja si un maestro los recomienda; E8.6, el apodo del veterano.
    const written = hireOffers({ hirelings: guildHirelings(getGuild(), HIRELINGS), party: partyMembers, fee: MERCENARY_FEE });
    // E8.4: y los de paso de esta semana, más baratos, con las mismas cuatro razones.
    const offers = withHireReasons([...written, ...await weeklyHireOffers(written.map(o => o.name))]);
    const choice = await openHirePanel({ Popup, POPUP_TYPE, offers, purse: partyPurse() });
    if (!choice) return '';
    const offer = offers.find(o => o.name === choice.name);
    if (!offer) return '';
    if (choice.action === 'fire') {
        // J14: lo que habíais vivido no se pierde: vuelve a ser suyo, de la gente del gremio.
        carryBondOf(partyMembers.find(m => String(m.id) === offer.id), 'leave');
        setPartyMembers(partyMembers.filter(m => String(m.id) !== offer.id));
        savePartyState();
        renderPartyMembers();
        renderLocationMapsPreview();
        const line = `${offer.name} se despide y se queda en el gremio.`;
        postCombatNarration(`🗡️ [GREMIO] ${line}`);
        toastr.info(line, 'Despedido');
        if (isShellOpen()) refreshGameShell();
        return line;
    }
    if (!payFromParty(offer.fee)) {
        toastr.warning(`No llega el oro: cuesta ${offer.fee}.`, 'Contratar');
        return '';
    }
    const hero = partyMembers.find(m => !m.guest) ?? partyMembers[0];
    const merc = guestMember({
        id: Date.now(), name: offer.name, kind: 'mercenary', contractId: HUB_CONTRACT, level: Number(/** @type {any} */ (offer).level) || Number(hero?.level) || 1,
        base: hero, stats: offer,
    });
    // E8.4: el de paso trae su especie, sus seis características, su rasgo y cómo se presentó.
    if (/** @type {any} */ (offer).weekly) Object.assign(merc, recruitPatch(/** @type {any} */ (offer)));
    const at = hero?.mapPosition ?? { locationName: currentLocationName, gridX: 1, gridY: 1 };
    merc.mapPosition = { ...at, gridX: (Number(at.gridX) || 0) + partyMembers.length };
    partyMembers.push(merc);
    // J14: si ya habíais quedado antes de contratarle, eso pasa a su ficha.
    carryBondOf(merc, 'join');
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    const line = `${merc.name} (${offer.className}) se une al grupo por ${offer.fee} de oro. Va contigo hasta que le despidas.`;
    postCombatNarration(`🗡️ [GREMIO] ${line}`);
    toastr.success(line, 'Mercenario');
    if (isShellOpen()) refreshGameShell();
    return line;
}

/**
 * J1.6: otro de tus personajes pasa a ir con el grupo, en el sitio y la casilla del de ahora.
 * Los mercenarios siguen. El que sale deja el grupo: lo guarda el gremio (`campaigns.js`).
 *
 * @param {PartyMember} incoming Tal cual se quedó en el gremio, o recién hecho de su ficha.
 * @returns {{outgoing: PartyMember|null, line: string}} El que sale, y lo que se ha contado.
 */
export function seatPartyHero(incoming) {
    const { party, outgoing } = seatHero({ party: partyMembers, incoming });
    setPartyMembers(hubRoster(party).map(member => migratePartyMember(member)));
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    const hero = partyMembers.find(m => String(m.id) === String(incoming?.id)) ?? partyMembers[0];
    if (hero) setUserName(hero.name, { toastPersonaNameChange: false });
    const line = swapLine(incoming, outgoing);
    postCombatNarration(`🏠 [GREMIO] ${line}`);
    if (isShellOpen()) refreshGameShell();
    return { outgoing: outgoing ? JSON.parse(JSON.stringify(outgoing)) : null, line };
}

/**
 * J4: la bolsa con la que se llega al gremio.
 *
 * @param {number} amount
 */
export function giveStartingPurse(amount) {
    const hero = partyMembers[0];
    if (!hero) return;
    hero.gold = (Number(hero.gold) || 0) + Math.max(0, Math.floor(Number(amount) || 0));
    savePartyState();
    renderPartyMembers();
}

/**
 * Idea 42: dejar a alguien en casa, o llamarle. Quien llega tarda un día.
 *
 * @param {'bench'|'call'} what
 * @param {string} id
 * @returns {string}
 */
function rotateBench(what, id) {
    if (!chat_metadata) return '';
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return '';
    }
    const result = what === 'bench'
        ? { ...benchMember({ party: partyMembers, bench: chat_metadata[BENCH_KEY], id }), days: 0 }
        : callFromBench({ party: partyMembers, bench: chat_metadata[BENCH_KEY], id });
    if (!result.ok) {
        toastr.warning(result.line);
        return '';
    }
    setPartyMembers(result.party);
    chat_metadata[BENCH_KEY] = result.bench;
    if (what === 'call') {
        const back = partyMembers[partyMembers.length - 1];
        // Llega donde está el grupo, al lado del primero.
        const lead = partyMembers[0]?.mapPosition ?? { locationName: currentLocationName, gridX: 0, gridY: 0 };
        if (back) back.mapPosition = { locationName: currentLocationName, gridX: (Number(lead.gridX) || 0) + 1, gridY: Number(lead.gridY) || 0 };
        for (let day = 0; day < result.days; day++) advanceCampaignDay();
    }
    savePartyState();
    saveMetadata();
    renderPartyMembers();
    postCombatNarration(`🏠 [GREMIO] ${result.line}`);
    toastr.info(result.line, what === 'bench' ? 'A casa' : 'De vuelta');
    if (isShellOpen()) refreshGameShell();
    return result.line;
}

/**
 * Sube un edificio, si el oro llega.
 *
 * Se cobra del mismo bolsillo que la cena: es lo que hace que construir sea una decision
 * y no una casilla que marcar cuando toca.
 *
 * @param {string} key
 * @param {number} purse
 * @returns {string}
 */
function raiseBuilding(key, purse) {
    const guild = getGuild();
    const next = upgradeCost(guild, key);
    if (next.maxed || purse < next.cost) {
        toastr.warning('No llega el oro para eso.');
        return '';
    }

    let owed = next.cost;
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
    }

    guild.buildings[key] = next.nextLevel;
    chat_metadata[GUILD_KEY] = guild;
    saveMetadata();
    savePartyState();

    const line = `${key} sube al nivel ${next.nextLevel} por ${next.cost} de oro.`;
    postCombatNarration(`🏛️ [GREMIO] ${line}`);
    toastr.success(line, 'La casa crece');
    return line;
}

/**
 * Que alguien deje de salir y se quede en casa con un puesto.
 *
 * Sale del grupo —no pelea, no cobra, no come a cuenta del grupo— y entra en el gremio,
 * donde su puesto abarata algo cada semana.
 *
 * @param {any} member
 * @param {string} role
 * @returns {string}
 */
export function retireMember(member, role) {
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    if (String(partyMembers[0]?.id) === String(member.id)) {
        toastr.warning('El tuyo no se retira: es tu partida.');
        return '';
    }
    const result = retireTo(getGuild(), String(member.name), role);
    if (!result.ok) {
        toastr.warning(result.line);
        return '';
    }

    chat_metadata[GUILD_KEY] = result.guild;
    setPartyMembers(partyMembers.filter(m => String(m.id) !== String(member.id)));
    saveMetadata();
    savePartyState();
    renderPartyMembers();

    noteDeed(result.line);
    void postForModel(`🏠 [GREMIO] ${result.line}`);
    toastr.success(result.line, 'Se queda en casa', { timeOut: 12000 });
    return result.line;
}

/**
 * Una ventana de la sala del gremio, con su «Cerrar» al pie. Las ventanas `vt-root` esconden los
 * botones del popup (campaigns.css: «cada tarjeta es su botón»), y sin este no había con qué
 * cerrarla más que con Esc. Como las de `hub-panel.js`.
 *
 * @param {JQuery<HTMLElement>} body
 * @param {{wide?: boolean}} [options]
 * @returns {Popup}
 */
function hallWindow(body, { wide = true } = {}) {
    const popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, wide, allowVerticalScrolling: true });
    body.append($('<div class="hb-foot"></div>').append($('<button type="button" class="menu_button hb-close"></button>')
        .text('Cerrar')
        .on('click', () => { void popup.completeCancelled(); })));
    return popup;
}

/**
 * J3.4: Abrir el cofre del gremio.
 */
export async function openGuildChest() {
    if (!lastHub) {
        toastr.info('El cofre está en la sala del gremio.', 'El cofre');
        return '';
    }
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.', 'El cofre');
        return '';
    }
    const body = $('<div class="vt-root hb-root"></div>');
    const inside = $('<div class="hb-chest"></div>');
    body.append(inside);
    /** Quién saca y quién deja: el que se elija (J3.4), no siempre el primero del grupo. */
    let whoId = String(partyMembers.find(m => !m.dead)?.id ?? '');
    const rowStyle = 'display:flex; justify-content:space-between; align-items:center; gap:8px; margin:4px 0;';

    /** Lo que se mueve de una ficha al cofre o al revés: se guarda y se vuelve a dibujar. */
    const moved = (/** @type {any} */ member, /** @type {{ok: boolean, reason: string, items: any[], storage: any[], line: string}} */ res) => {
        if (!res.ok) {
            toastr.warning(res.reason, 'El cofre');
            return;
        }
        chat_metadata[STORAGE_KEY] = res.storage;
        member.items = res.items;
        saveMetadata();
        savePartyState();
        renderPartyMembers();
        postCombatNarration(`📦 [GREMIO] ${res.line}`);
        toastr.success(res.line, 'El cofre');
        draw();
    };
    /** El oro que entra o sale del arca. */
    const paid = (/** @type {any} */ member, /** @type {{ok: boolean, reason: string, gold: number, guild: any, line: string}} */ res) => {
        if (!res.ok) {
            toastr.warning(res.reason, 'El arca');
            return;
        }
        member.gold = res.gold;
        chat_metadata[GUILD_KEY] = res.guild;
        saveMetadata();
        savePartyState();
        renderPartyMembers();
        toastr.success(res.line, 'El arca');
        draw();
    };

    const draw = () => {
        const guild = getGuild();
        const view = chestView({ storage: chat_metadata?.[STORAGE_KEY], guild, party: partyMembers });
        const who = view.carried.find(c => c.memberId === whoId) ?? view.carried[0] ?? null;
        whoId = who?.memberId ?? '';
        const member = partyMembers.find(m => String(m.id) === whoId) ?? null;
        inside.empty();
        inside.append($('<div class="vt-head"></div>')
            .append($('<h3 class="vt-title"></h3>').text('El cofre del gremio'))
            .append($('<p class="vt-sub"></p>').text(`${view.used} de ${view.slots} huecos ocupados · ${view.gold} de oro en el arca.`)));

        if (view.carried.length > 1) {
            const select = $('<select class="text_pole hb-chest-who"></select>');
            for (const c of view.carried) select.append($('<option></option>').val(c.memberId).text(`${c.name} (${c.gold} de oro)`));
            select.val(whoId).on('change', () => {
                whoId = String(select.val() ?? '');
                draw();
            });
            inside.append($(`<label style="${rowStyle}"></label>`).append($('<span></span>').text('Quién saca y quién deja:'), select));
        }

        inside.append($('<div class="vt-section hb-section"></div>').text('En el cofre'));
        if (view.stored.length === 0) inside.append($('<p class="hb-empty"></p>').text('El cofre está vacío.'));
        for (const g of view.stored) {
            const row = $(`<div class="hb-chest-row" style="${rowStyle}"></div>`);
            row.append($('<span></span>').text(`${g.name}${g.count > 1 ? ` ×${g.count}` : ''}${g.note ? ` (${g.note})` : ''}`));
            row.append($('<button type="button" class="menu_button"></button>')
                .text(who ? `Sacar para ${who.name}` : 'Sacar')
                .prop('disabled', !member)
                .on('click', () => { if (member) moved(member, takeFromChest(member, chat_metadata?.[STORAGE_KEY], g.ids[0])); }));
            inside.append(row);
        }

        if (who && member) {
            inside.append($('<div class="vt-section hb-section"></div>').text(`Lo que lleva ${who.name}`));
            if (who.items.length === 0) inside.append($('<p class="hb-empty"></p>').text('No lleva nada que dejar.'));
            for (const item of who.items) {
                const row = $(`<div class="hb-chest-row" style="${rowStyle}"></div>`);
                row.append($('<span></span>').text(`${item.name}${item.note ? ` (${item.note})` : ''}`));
                const leave = $('<button type="button" class="menu_button"></button>').text('Dejar en el cofre')
                    .prop('disabled', !item.canStore)
                    .on('click', () => moved(member, putInChest(member, chat_metadata?.[STORAGE_KEY], item.id)));
                if (item.why) leave.attr('title', item.why);
                row.append(leave);
                if (item.why) row.append($('<small class="hb-warn"></small>').text(item.why));
                inside.append(row);
            }

            inside.append($('<div class="vt-section hb-section"></div>').text('El arca'));
            inside.append($('<p class="hb-state"></p>').text(`${who.name} lleva ${who.gold} de oro. En el arca hay ${view.gold}. Lo que se deja en el arca lo puede sacar cualquiera de los tuyos.`));
            const amount = $('<input type="number" class="text_pole hb-chest-amount" min="1" step="1" style="max-width:8em;">').val(String(Math.min(10, Math.max(1, who.gold || view.gold || 1))));
            const howMuch = () => Math.max(0, Math.floor(Number(amount.val()) || 0));
            inside.append($(`<div class="hb-chest-gold" style="${rowStyle} justify-content:flex-start;"></div>`).append(
                amount,
                $('<button type="button" class="menu_button"></button>').text('Dejar oro').prop('disabled', who.gold <= 0)
                    .on('click', () => paid(member, depositGold(member, getGuild(), howMuch()))),
                $('<button type="button" class="menu_button"></button>').text('Sacar oro').prop('disabled', view.gold <= 0)
                    .on('click', () => paid(member, withdrawGold(member, getGuild(), howMuch()))),
            ));
        }
    };
    draw();

    await hallWindow(body).show();
    // La sala dice cuántas cosas hay en el cofre: que lo diga ya.
    if (isShellOpen()) refreshGameShell();
    return '';
}

/**
 * J3.6: cobrar lo de la casa (la forja, la biblioteca): primero del arca y lo que falte, de las
 * bolsas (`payPlan`). Si no llega, no se cobra nada.
 *
 * @param {number} cost
 * @returns {boolean} Si se ha pagado.
 */
function payHouse(cost) {
    const guild = getGuild();
    const plan = payPlan({ cost, guild, purse: partyPurse() });
    if (!plan.ok || (plan.fromPurse > 0 && !payFromParty(plan.fromPurse))) {
        toastr.warning(plan.line || 'No llega el oro para eso.', 'La casa');
        return false;
    }
    chat_metadata[GUILD_KEY] = spendFromChest(guild, plan.fromChest);
    saveMetadata();
    return true;
}

/**
 * J3.6: La casa del gremio y sus edificios; y lo que abren, en cuanto están: la forja y la
 * biblioteca se usan aquí mismo.
 */
export async function openGuildHouse() {
    if (!lastHub) {
        toastr.info('Los edificios se mejoran en el gremio.', 'La casa');
        return '';
    }
    const body = $('<div class="vt-root hb-root"></div>');
    const inside = $('<div class="hb-house"></div>');
    body.append(inside);

    /** Se dibuja otra vez tras cada obra: con el gremio y las bolsas de ahora, no los de antes. */
    const draw = () => {
        const guild = getGuild();
        const purse = partyPurse();
        const rows = houseView({ guild, purse, fighting: combatEncounter.active });
        inside.empty();
        inside.append($('<div class="vt-head"></div>')
            .append($('<h3 class="vt-title"></h3>').text('La casa del gremio'))
            .append($('<p class="vt-sub"></p>').text(`Mejora los edificios con el oro del arca y de vuestras bolsas. En el arca hay ${Math.max(0, Number(guild.gold) || 0)} de oro; lleváis ${purse}.`)));

        const grid = $('<div class="vt-grid hb-grid"></div>');
        for (const r of rows) {
            const card = $('<div class="vt-card hb-card"></div>').attr('data-building', r.key);
            card.append($('<div class="vt-name"></div>').text(`${r.label} (nivel ${r.level} de ${r.max})`));
            // J3.6: lo que ya abre, para que se vea qué se ha ganado con cada nivel.
            if (r.open.length > 0) card.append($('<div class="hb-opened"></div>').text(`Ya tenéis: ${r.open[r.open.length - 1]}`));
            if (r.next) {
                card.append($('<div class="vt-what"></div>').text(`Siguiente: ${r.next.opens}`));
                card.append($('<div class="hb-state"></div>').text(`Cuesta ${r.next.cost} de oro. ${r.next.pay}`));
                if (r.next.ok) {
                    card.append($('<button type="button" class="menu_button"></button>').text('Mejorar').on('click', function () {
                        $(this).prop('disabled', true);
                        const now = getGuild();
                        const done = buildInGuild({ guild: now, key: r.key, purse: partyPurse() });
                        // Lo que falta del arca sale de las bolsas: si no llega, no se levanta nada.
                        if (!done.ok || (done.fromPurse > 0 && !payFromParty(done.fromPurse))) {
                            toastr.warning(done.reason || 'No llega el oro para eso.', 'La casa');
                            draw();
                            return;
                        }
                        chat_metadata[GUILD_KEY] = done.guild;
                        saveMetadata();
                        savePartyState();
                        renderPartyMembers();
                        // J3.6: con camas nuevas llega alguien que se puede contratar.
                        const arrival = r.key === 'bunks' ? recruitArrival(r.next?.level ?? 0) : '';
                        postCombatNarration(`🏛️ [GREMIO] ${[done.line, arrival].filter(Boolean).join(' ')}`);
                        toastr.success([done.line, arrival].filter(Boolean).join(' '), 'La casa crece');
                        draw();
                    }));
                } else {
                    card.append($('<div class="hb-warn"></div>').text(r.next.why || 'Ahora no se puede.'));
                }
            } else {
                card.append($('<div class="hb-state"></div>').text('Ya está al máximo.'));
            }
            grid.append(card);
        }
        inside.append(grid);
        drawForge(guild, purse);
        drawLibrary(guild);
        // E5.1: el temple de la forja, las raciones de la cocina y los libros de bichos.
        drawGuildPrep(inside, draw);
        drawGuildBooks(inside, draw);
    };

    /**
     * J3.6: la forja del gremio, en cuanto hay forja: mejorar armas y reforzar armaduras.
     *
     * @param {any} guild
     * @param {number} purse
     */
    const drawForge = (guild, purse) => {
        const forge = forgeOffers({ guild, party: partyMembers, purse });
        if (forge.level === 0) return;
        const box = $('<div class="hb-forge"></div>');
        box.append($('<div class="vt-section hb-section"></div>').text(`La forja (nivel ${forge.level})`));
        if (forge.empty) box.append($('<p class="hb-empty"></p>').text(forge.empty));
        for (const offer of forge.offers) {
            const row = $('<div class="hb-chest-row hb-forge-row" style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin:4px 0;"></div>');
            row.append($('<span></span>').text(`${offer.memberName}: ${offer.label}`));
            row.append($('<button type="button" class="menu_button hb-forge-go"></button>').text(`Mejorar (${offer.cost} de oro)`)
                .prop('disabled', !offer.ok || combatEncounter.active)
                .attr('title', offer.why || 'Se paga del arca y, lo que falte, de las bolsas.')
                .on('click', () => {
                    const member = partyMembers.find(m => String(m.id) === offer.memberId);
                    const done = member ? forgeItem({ member, itemId: offer.itemId, guild: getGuild(), purse: partyPurse() }) : null;
                    if (!member || !done?.ok || !payHouse(done.cost)) {
                        if (done && !done.ok) toastr.warning(done.reason, 'La forja');
                        draw();
                        return;
                    }
                    member.items = done.items;
                    savePartyState();
                    renderPartyMembers();
                    postCombatNarration(`🔨 [GREMIO] ${done.line}`);
                    toastr.success(done.line, 'La forja');
                    draw();
                }));
            if (!offer.ok && offer.why) row.append($('<small class="hb-warn"></small>').text(offer.why));
            box.append(row);
        }
        inside.append(box);
    };

    /**
     * J3.6: la biblioteca del gremio, en cuanto hay biblioteca: copiar un conjuro al libro, o
     * cambiar uno que se sabe por otro.
     *
     * @param {any} guild
     */
    const drawLibrary = (guild) => {
        const catalogue = spellRows();
        const library = libraryOffers({ guild, party: partyMembers, classRowOf, catalogue });
        if (library.level === 0) return;
        const box = $('<div class="hb-library"></div>');
        box.append($('<div class="vt-section hb-section"></div>').text(`La biblioteca (nivel ${library.level})`));
        if (library.empty) box.append($('<p class="hb-empty"></p>').text(library.empty));
        for (const reader of library.readers) {
            box.append($('<p class="hb-state"></p>').text(`${reader.name}: ${reader.note}`));
            if (reader.mode === 'none') continue;
            // Quien cambia elige antes qué deja de saber.
            const forget = reader.mode === 'swap' ? $('<select class="text_pole hb-library-forget"></select>') : null;
            for (const known of reader.known) forget?.append($('<option></option>').val(known.id).text(`Deja de saber «${known.name}»`));
            if (forget) box.append(forget);
            // Lo que puede aprender, todo en una lista (a un mago de nivel 1 le caben decenas), y un botón.
            const pick = $('<select class="text_pole hb-library-pick"></select>');
            for (const option of reader.options) pick.append($('<option></option>').val(option.id).text(`«${option.name}» · nivel ${option.level} · ${option.cost} de oro`));
            const row = $('<div class="hb-chest-row" style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin:4px 0;"></div>');
            row.append(pick);
            row.append($('<button type="button" class="menu_button hb-library-go"></button>')
                .text(reader.mode === 'copy' ? 'Copiarlo en su libro' : 'Aprenderlo')
                .prop('disabled', combatEncounter.active || reader.options.length === 0)
                .on('click', () => {
                    const member = partyMembers.find(m => String(m.id) === reader.memberId);
                    const done = member ? learnSpell({
                        member, guild: getGuild(), classRowOf, catalogue, spellId: String(pick.val() ?? ''), forget: String(forget?.val() ?? ''), purse: partyPurse(),
                    }) : null;
                    if (!member || !done?.ok || !payHouse(done.cost)) {
                        if (done && !done.ok) toastr.warning(done.reason, 'La biblioteca');
                        draw();
                        return;
                    }
                    Object.assign(member, done.patch);
                    savePartyState();
                    renderPartyMembers();
                    postCombatNarration(`📚 [GREMIO] ${done.line}`);
                    toastr.success(done.line, 'La biblioteca');
                    draw();
                }));
            box.append(row);
        }
        inside.append(box);
    };
    draw();

    await hallWindow(body).show();
    if (isShellOpen()) refreshGameShell();
    return '';
}

/**
 * J3.5: Entrenar en el gremio.
 */
export async function openGuildTraining() {
    if (!lastHub) {
        toastr.info('El patio de entrenamiento está en el gremio.', 'Entrenamiento');
        return '';
    }
    // Los tuyos que descansan en el gremio cuentan para «va por detrás: aprende el doble».
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName).catch(() => null) : null;
    const resting = readRestingHeroes(data?.metadata?.[HUB_HEROES_KEY]);
    const body = $('<div class="vt-root hb-root"></div>');
    const inside = $('<div class="hb-training"></div>');
    body.append(inside);
    /** @type {Popup|null} */
    let popup = null;

    const draw = () => {
        const guild = getGuild();
        const view = trainingView({ party: partyMembers, resting, guild, calendar: getCampaignCalendar(), xpTable: getXpTable(), fighting: combatEncounter.active });
        inside.empty();
        inside.append($('<div class="vt-head"></div>')
            .append($('<h3 class="vt-title"></h3>').text('Patio de entrenamiento'))
            .append($('<p class="vt-sub"></p>').text(view.can.enabled
                ? `Todo el grupo se ejercita en el patio con las armas y los maestros. Gasta la ${String(view.slot).toLowerCase() || 'mañana'}.`
                : view.can.why)));
        for (const row of view.rows) {
            const line = $('<div class="hb-state" style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin:4px 0;"></div>')
                .append($('<span></span>').text(`${row.name}: ${row.note}${view.can.enabled && row.gain > 0 && row.nextAt !== null ? ` Entrenando gana ${row.gain}.` : ''}`));
            if (row.canLevel) {
                // J3.5: quien ya tiene la experiencia sube aquí mismo, con su tarjeta de subir de nivel.
                line.append($('<button type="button" class="menu_button"></button>').text('Subir de nivel').on('click', async () => {
                    const member = partyMembers.find(m => String(m.id) === row.id);
                    if (!member) return;
                    await popup?.completeCancelled();
                    await openLevelUpCard(member);
                }));
            }
            inside.append(line);
        }
        for (const hero of view.resting) inside.append($('<p class="hb-state"></p>').text(`${hero.name}: ${hero.note}`));

        if (view.can.enabled && view.rows.length > 0) {
            inside.append($('<button type="button" class="menu_button"></button>').text('Entrenar').on('click', function () {
                $(this).prop('disabled', true);
                const res = trainSession({ party: partyMembers, resting, guild: getGuild(), calendar: getCampaignCalendar(), xpTable: getXpTable(), fighting: combatEncounter.active });
                if (!res.ok) {
                    toastr.warning(res.reason, 'Entrenamiento');
                    draw();
                    return;
                }
                for (const gain of res.gains) {
                    const m = partyMembers.find(p => String(p.id) === String(gain.id));
                    if (m) m.xp = (Number(m.xp) || 0) + gain.xp;
                }
                savePartyState();
                renderPartyMembers();
                // Entrenar gasta la parte del día (mañana o tarde), no el día entero: la
                // siguiente sesión ya es en otra parte del día, o mañana.
                spendDayPart('entrenar');
                postCombatNarration(`🏋️ [GREMIO] ${res.line}`);
                toastr.success(res.line, 'Entrenamiento');
                draw();
            }));
        }
    };
    draw();

    popup = hallWindow(body, { wide: false });
    await popup.show();
    if (isShellOpen()) refreshGameShell();
    return '';
}

/**
 * J3.8: Encargos del tablón del gremio.
 */
export async function openGuildErrands() {
    if (!lastHub) {
        toastr.info('Los encargos del gremio se miran en el tablón.', 'Encargos');
        return '';
    }
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName).catch(() => null) : null;
    const view = errandCards({
        board: refreshContractBoard(),
        taken: chat_metadata?.[TAKEN_KEY],
        day: Math.max(1, campaignDay()),
        here: currentLocationName,
        locations: getCurrentWorldLocationMaps(),
        hidden: data?.metadata?.hiddenLocations ?? [],
        fighting: combatEncounter.active,
    });
    const body = $('<div class="vt-root hb-root"></div>');
    body.append($('<div class="vt-head"></div>')
        .append($('<h3 class="vt-title"></h3>').text('Encargos del tablón'))
        .append($('<p class="vt-sub"></p>').text(view.taken ? view.taken.line : 'Recados y trabajos cortos de la gente de Puerto Alba.')));

    /** El encargo elegido: se acepta al cerrar, como en el panel del gremio. */
    let chosen = '';
    /** @type {Popup|null} */
    let popup = null;
    const list = $('<div class="vt-grid hb-grid"></div>');
    if (view.offers.length === 0) list.append($('<p class="hb-empty"></p>').text('El tablón está vacío por ahora.'));
    for (const e of view.offers) {
        const card = $('<div class="vt-card hb-card"></div>');
        card.append($('<div class="vt-name"></div>').text(e.title));
        card.append($('<div class="vt-what"></div>').text([e.patron, e.where, e.how].filter(Boolean).join(' ')));
        card.append($('<div class="hb-state"></div>').text(`${e.pay} · ${e.due}`));
        // E5.3: lo menor se puede mandar hacer a quien espera en casa, sin el héroe.
        const errand = (Array.isArray(chat_metadata?.[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : []).find((/** @type {any} */ c) => String(c?.id) === e.id);
        if (errand && canDispatch(errand).ok && !combatEncounter.active) {
            card.append($('<button type="button" class="menu_button hb-errand-send"></button>').text('Que vaya alguien de casa').on('click', async function () {
                const { openDispatch } = await import('./contracts.js');
                if (await openDispatch(errand, { bench: true })) $(this).replaceWith($('<div class="hb-state"></div>').text('Mandados. Volverán con el informe.'));
            }));
        }
        if (e.enabled) {
            card.append($('<button type="button" class="menu_button"></button>').text('Aceptar').on('click', () => {
                chosen = e.id;
                void popup?.completeAffirmative();
            }));
        } else {
            card.append($('<div class="hb-warn"></div>').text(e.why));
        }
        list.append(card);
    }
    body.append(list);
    // El «Cerrar» va debajo de los encargos: la ventana se hace cuando ya están.
    popup = hallWindow(body);
    await popup.show();
    if (!chosen) return '';
    // J3.8: el sitio del encargo, si aún no salía en el mapa, sale ahora: sin él no se llega.
    const contract = (Array.isArray(chat_metadata?.[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : []).find((/** @type {any} */ c) => String(c?.id) === chosen);
    const hidden = data?.metadata?.hiddenLocations ?? [];
    const revealed = contract ? errandReveal(contract, hidden) : [];
    const said = await acceptContract(chosen);
    if (!said || revealed.length === 0) return said;
    await revealLocations(revealed);
    const line = errandAcceptLine(contract, { revealed, here: currentLocationName, locations: getCurrentWorldLocationMaps(), hidden });
    postCombatNarration(`🗺️ [GREMIO] ${line}`);
    toastr.info(line, 'Encargo aceptado', { timeOut: 9000 });
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    return said;
}

/**
 * J1.6: Tus personajes en el gremio.
 */
export async function openHubHeroes() {
    if (!lastHub) {
        toastr.info('Tus personajes esperan en el gremio.', 'Tus personajes');
        return '';
    }
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.', 'Tus personajes');
        return '';
    }
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName).catch(() => null) : null;
    const heroes = hubHeroCards({ party: partyMembers, resting: data?.metadata?.[HUB_HEROES_KEY] });
    // La misma ventana que al entrar en el gremio: quién va, o hacer otro (J1.6).
    const { openHeroChooser } = await import('../game-engine/ui/hub-panel.js');
    const picked = await openHeroChooser({
        Popup, POPUP_TYPE, heroes,
        title: 'Tus personajes',
        sub: 'Quién va con el grupo. El que se queda descansa aquí, con su nivel, su equipo y su oro.',
    });
    if (picked) {
        const { changeHubHero } = await import('../campaigns.js');
        await changeHubHero(picked);
    }
    return '';
}

/**
 * J11.4: La memoria del gremio y las huellas del mundo.
 */
export async function openMemoryView() {
    // Lo que recuerda el gremio está en el mundo del gremio: en él, el de ahora; en una campaña
    // que salió de él, el de casa (`lastHubHome`). Si no, en la campaña solo saldrían las huellas.
    const worldName = lastHub ? String(chat_metadata?.[METADATA_KEY] || '') : String(lastHubHome || '');
    const data = worldName ? await loadWorldInfo(worldName).catch(() => null) : null;
    // Las huellas (J11.3) se leen con las filas de `ecos.json`: sin ellas no se dice ninguna.
    const { compendium } = await getCompendium();
    await openMemoryPanel({
        town: currentLocationName,
        marks: chat_metadata?.[WORLD_MARKS_KEY],
        rows: compendium?.has?.('ecos') ? compendium.find('ecos', {}) : [],
        // Lo que recuerda el gremio se guarda en su mundo, no en la partida (`guild-memory.js`).
        memory: data?.metadata?.[GUILD_MEMORY_KEY],
        hub: data?.metadata?.hub,
        today: campaignDay(),
    });
}

/**
 * J3.3: dormir en el gremio. La noche en las camas de la casa, sin pagar: cura como un descanso
 * largo, amanece y guarda la partida en su ranura, «Al dormir en el gremio» (J15.2).
 *
 * @returns {Promise<string>} Lo que se contó del descanso, o vacío.
 */
export async function sleepInGuild() {
    if (!lastHub) {
        toastr.info('Se duerme en la casa del gremio.', 'Dormir');
        return '';
    }
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.', 'Dormir');
        return '';
    }
    const said = await takeRest('largo', { under: 'techo' });
    if (!said) return '';
    // Guardar va después del descanso: la ranura se queda con la mañana y el grupo curado.
    const { onGuildSleep } = await import('../guardar-partida.js');
    await onGuildSleep();
    if (isShellOpen()) refreshGameShell();
    return said;
}

/**
 * J3.7: la noticia de que el gremio ha subido de rango se cuenta una vez. Sale arriba en la sala
 * (`buildHallData`) hasta que se usa algo de ella; entonces se apunta como contada (`rankSeen`).
 *
 * @returns {void}
 */
export function noteRankSeen() {
    if (!lastHub || !chat_metadata) return;
    const guild = getGuild();
    const worlds = knownBoardRows();
    const { renown } = hubRenown({ guild, hub: lastHub, worlds });
    const news = rankNews({ guild, renown, hub: lastHub, worlds });
    if (!news) return;
    chat_metadata[GUILD_KEY] = { ...guild, rankSeen: news.rank };
    saveMetadata();
}

/**
 * J3.1: Los datos del estado de la sala del gremio para la pantalla del pueblo y el panel.
 *
 * Solo lee: se llama cada vez que se dibuja el pueblo. Lo que no se sabe sin leer el mundo
 * (quién descansa en el gremio) no se pone: mejor sin línea que con un número inventado. Las
 * campañas del tablón se leen una vez (`knownBoardRows`) y salen en cuanto llegan (J3.7).
 *
 * @returns {import('../game-engine/campaign/guild-hall.js').HallData|null}
 */
export function buildHallData() {
    try {
        const guild = getGuild();
        const purse = partyPurse();
        const calendar = getCampaignCalendar();
        const chest = chestView({ storage: chat_metadata?.[STORAGE_KEY], party: partyMembers, guild });
        const training = trainingView({ party: partyMembers, guild, calendar, xpTable: getXpTable(), fighting: combatEncounter.active });
        const houseRows = houseView({ guild, purse });
        const built = houseRows.reduce((sum, r) => sum + r.level, 0);
        const total = houseRows.reduce((sum, r) => sum + r.max, 0);
        // J3.7: con las campañas del tablón, lo que da cada una terminada y las que abre el rango.
        const worlds = knownBoardRows();
        const { renown } = hubRenown({ guild, hub: lastHub, worlds });
        const taken = chat_metadata?.[TAKEN_KEY];
        const board = Array.isArray(chat_metadata?.[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [];
        // La salida de la sala: las campañas empezadas y sin terminar, para seguirlas (J3.1). Eso
        // sí se sabe sin leer el mundo: el gremio lo apunta (`lastHub`). Las por empezar, no.
        const inProgress = Object.entries(lastHub?.campaigns ?? {})
            .filter(([, c]) => c && !c.finished && c.chat)
            .map(([id, c]) => ({ id, name: String(c.name || c.worldName || id) }));
        // Las por empezar y las cerradas, en cuanto se saben las del tablón.
        const offered = worlds.length > 0 ? lockCampaignCards(hubCampaignCards({ worlds, hub: lastHub }), { renown, worlds }) : [];
        const open = offered.filter(c => c.state === 'nueva' && !c.locked).length;
        const locked = offered.filter(c => c.locked).length;
        return {
            ...(inProgress.length > 0 || offered.length > 0 ? { campaigns: { open, locked, inProgress } } : {}),
            rank: guildRank(renown),
            news: rankNews({ guild, renown, hub: lastHub, worlds }),
            chest: { used: chest.used, slots: chest.slots, gold: chest.gold },
            training: {
                ready: training.rows.filter(r => r.canLevel).map(r => r.name),
                can: training.can.enabled,
                why: training.can.why,
            },
            house: { built, total },
            // E5.2: quién está para salir, y si alguien ha vuelto con su informe.
            rest: { line: restHallLine() },
            // Un tablón que aún no se ha llenado no está vacío: sin línea hasta que se mire.
            ...(board.length > 0 || taken ? { errands: { offers: board.length, taken: taken ? String(taken.title || '') : '' } } : {}),
        };
    } catch (error) {
        console.warn('[gremio] buildHallData', error);
        return null;
    }
}
