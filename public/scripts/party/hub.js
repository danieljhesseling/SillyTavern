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
import { campaignHallEntry } from '../game-engine/campaign/campaign-end.js';
import { readBench, benchMember, callFromBench, whereHired } from '../game-engine/campaign/bench.js';
import { store, retrieve, readStorage } from '../game-engine/campaign/storage.js';
import { guestMember, HIRELINGS, MERCENARY_FEE } from '../game-engine/campaign/guests.js';
import {
    isHubWorld, hubCampaignCards, hireOffers, hubRoster, hubTrial, HUB_CONTRACT,
} from '../game-engine/campaign/hub.js';
import { HUB_HEROES_KEY, hubHeroCards, seatHero, swapLine } from '../game-engine/campaign/hub-heroes.js';
import { isIronRun, modeOf, modeLabel } from '../game-engine/rules/modes.js';
import { readGraves, addToHall, readHall } from '../game-engine/campaign/legacy.js';
import { retireTo, upgradeCost, describeGuild } from '../game-engine/campaign/guild.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { BENCH_KEY, GRAVES_KEY, GUILD_KEY, MODE_HISTORY_KEY, PLOT_STATE_KEY, STORAGE_KEY } from './keys.js';
import { combatEncounter, currentLocationName, partyMembers, setPartyMembers } from './state.js';
import { acceptContract, getGuild, refreshContractBoard } from './contracts.js';
import {
    savePartyState, renderPartyMembers, postCombatNarration, postForModel, survivalNow, countStat, partyPurse,
    payFromParty,
} from './main.js';
import { instancesFromPlacements } from './combat-flow.js';
import { awardEncounterLoot } from './loot.js';
import { recordBoardWon } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { ensureWorldData, lastHub, lastHubHome } from './world.js';
import { getCurrentWorldFactions } from './factions.js';
import { getCampaignCalendar, campaignDay, advanceCampaignDay, markLocationComplete } from './time.js';
import { getPlot, notePlot, plotEndingTitle } from './plot.js';
import { noteDeed } from './world-growth.js';

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
        // Una campaña escrita se llama como su hilo («La Maldición de Strahd»), sin el héroe que
        // lleva el nombre del mundo; una improvisada, como su mundo.
        campaign: plot?.source === 'written' && plot.title ? plot.title : world,
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
        return [
            // J2.3: la prueba se puede saltar mientras está por hacer. Va junto a la de pelearla.
            ...(hubTrial(getPlot(), chat_metadata?.[PLOT_STATE_KEY])
                ? [{ id: 'hub-skip', label: 'Saltar la prueba', icon: 'fa-forward', command: '/saltar-prueba' }] : []),
            { id: 'hub-board', label: 'Tablón de campañas', icon: 'fa-scroll', command: '/campanas' },
            { id: 'hub-hire', label: 'Contratar mercenarios', icon: 'fa-coins', command: '/contratar' },
            // J3.9: el salón de la fama, en cuanto hay alguien (o alguna campaña) en él.
            ...(readHall(/** @type {any} */ (extension_settings).partyHall).length > 0
                ? [{ id: 'hub-hall', label: 'Salón de la fama', icon: 'fa-monument', command: '/salon' }] : []),
        ];
    }
    if (lastHubHome) {
        return [
            // J4.5: con la campaña terminada, su final se puede volver a ver.
            ...(chat_metadata?.plotEnding ? [{ id: 'hub-ending', label: 'El final', icon: 'fa-flag-checkered', command: '/final' }] : []),
            { id: 'hub-home', label: 'Volver al gremio', icon: 'fa-house-flag', command: '/volver-gremio' },
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
    const home = getCurrentWorldLocationMaps().find((/** @type {any} */ l) => (l?.boards ?? []).some((/** @type {any} */ b) => same(b?.name, trial.board)));
    const place = trial.place || String(home?.name ?? '') || currentLocationName;
    const board = (home?.boards ?? []).find((/** @type {any} */ b) => same(b?.name, trial.board));
    postCombatNarration(`⏭️ [HILO] Te saltas «${trial.title}»: cuenta como hecha.`);
    // Lo mismo que deja ganarla: el botín de los que esperaban, el tablero y el sitio.
    const defeated = instancesFromPlacements(Array.isArray(board?.enemyPlacements) ? board.enemyPlacements : []);
    const loot = awardEncounterLoot(defeated);
    if (loot?.gold) countStat('gold', loot.gold);
    recordBoardWon(place, trial.board);
    markLocationComplete(place);
    for (const name of new Set(defeated.map(e => String(e.name).replace(/\s+\d+$/, '')))) {
        notePlot({ kind: 'defeat', enemy: name });
    }
    notePlot({ kind: 'win', place, board: trial.board });
    renderPartyMembers();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    return trial.id;
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
    const worlds = await fetch('/mundos/mundos.json', { cache: 'no-cache' })
        .then(response => response.json())
        .then(json => (Array.isArray(json?.worlds) ? json.worlds : []))
        .catch(() => []);
    const cards = hubCampaignCards({ worlds, hub: data?.metadata?.hub, level: Number(partyMembers.find(m => !m.guest)?.level) || 1 });
    // J1.6: arriba, quién va; tus personajes del gremio, para cambiarlo antes de salir.
    const heroes = hubHeroCards({ party: partyMembers, resting: data?.metadata?.[HUB_HEROES_KEY] });
    const { openHubBoard } = await import('../game-engine/ui/hub-panel.js');
    const picked = await openHubBoard({ Popup, POPUP_TYPE, cards, heroes });
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
    const offers = hireOffers({ hirelings: HIRELINGS, party: partyMembers, fee: MERCENARY_FEE });
    const choice = await openHirePanel({ Popup, POPUP_TYPE, offers, purse: partyPurse() });
    if (!choice) return '';
    const offer = offers.find(o => o.name === choice.name);
    if (!offer) return '';
    if (choice.action === 'fire') {
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
        id: Date.now(), name: offer.name, kind: 'mercenary', contractId: HUB_CONTRACT, level: Number(hero?.level) || 1,
        base: hero, stats: offer,
    });
    const at = hero?.mapPosition ?? { locationName: currentLocationName, gridX: 1, gridY: 1 };
    merc.mapPosition = { ...at, gridX: (Number(at.gridX) || 0) + partyMembers.length };
    partyMembers.push(merc);
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
