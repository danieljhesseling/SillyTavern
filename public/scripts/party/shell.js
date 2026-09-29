/**
 * El Modo Juego: lo que dibuja cada escena, la fila de fichas, la pausa y sus opciones, la
 * bandeja de avisos y abrirse al arrancar.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata, online_status, name2, getCurrentChatId } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import { getDistanceInFeet } from './combat-rules.js';
import { petName } from '../game-engine/campaign/pet.js';
import { judgeMagicItems } from '../game-engine/rules/magic-items.js';
import { judgeManeuvers } from '../game-engine/combat/maneuvers.js';
import { judgeThrows, sceneryNear, judgeSceneryThrow } from '../game-engine/combat/throwables.js';
import { describeSeason } from '../game-engine/world/seasons.js';
import { offerChips } from '../game-engine/campaign/item-offers.js';
import { nextTone, describeTone, readTone } from '../game-engine/campaign/scene-tone.js';
import { hasAction } from '../game-engine/combat/turn-machine.js';
import { describeMode as describeGameMode } from '../game-engine/rules/modes.js';
import { readHall, describeHallCount } from '../game-engine/campaign/legacy.js';
import { SKILLS, checkOptions } from '../game-engine/rules/checks.js';
import { fortuneLine } from '../game-engine/world/fortune.js';
import { pendingByPlace } from '../game-engine/campaign/guidance.js';
import { addNotice, unseenCount, MAX_VISIBLE_TOASTS } from '../game-engine/ui/shell/notices.js';
import { readRequests } from '../game-engine/campaign/check-requests.js';
import { enterScene } from '../game-engine/campaign/session-log.js';
import { focusOf, readPlotState } from '../game-engine/campaign/plot.js';
import { canExplore, readProposals } from '../game-engine/world/growth.js';
import { servicesOf } from '../game-engine/campaign/services.js';
import { prisonerChips } from '../game-engine/campaign/prisoners.js';
import { daysUntil } from '../game-engine/world/festivals.js';
import { MOMENT_TIPS } from '../game-engine/ui/shell/tips.js';
import { LENGTHS, nextLength } from '../game-engine/campaign/narration.js';
import { forageCheck } from '../game-engine/campaign/forage.js';
import { usesLeft, canUseAbility, describeAbility } from '../game-engine/rules/abilities.js';
import { isShellOpen, toggleGameShell, refreshGameShell, closeGameShell } from '../game-engine/ui/shell/game-shell.js';
import { buildDialogueView } from '../game-engine/ui/shell/dialogue-scene.js';
import { buildExplorationView } from '../game-engine/ui/shell/exploration-scene.js';
import { buildClockView, availableHitDice } from '../game-engine/ui/shell/clock-widget.js';
import { buildActionChips } from '../game-engine/ui/shell/action-chips.js';
import {
    BOARD_KEY, CHECK_REQUESTS_KEY, COLORBLIND_KEY, GAME_SHELL_AUTOSTART_KEY, LEAVE_ON_KEY, LENGTH_KEY,
    NARRATOR_FONT_KEY, NARRATOR_MODE_STORAGE, OFFERS_KEY, PENDING_CHECK_KEY, PLOT_STATE_KEY, PRISONERS_KEY,
    PROPOSALS_KEY, RUMORS_HEARD_KEY, SAFETY_ON_KEY, SAVER_KEY, SUCESOS_STORAGE, TAKEN_KEY, TONE_KEY,
    WEEK_TABLE_AUTO_KEY, localFlag,
} from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setTalkingTo, setTypedIntents,
    typedIntents,
} from './state.js';
import { getXpTable } from './level-up.js';
import { currentPet, openPetPanel } from './pet.js';
import { carriedNames, getAbilityCatalogue, knownAbilitiesOf, useAbility, useMagicItem } from './magic.js';
import { hubChips } from './hub.js';
import {
    getAliveEnemies, getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry,
    getRemainingMovementFeet,
} from './combat-state.js';
import { buildEnemyIntents } from './enemy-turn.js';
import {
    judgeCurrentScenario, resolveAllyTurnAction, retreatFromCombat, startWaitingFight, waitingSummary,
} from './combat-flow.js';
import {
    confirmEndTurn, endPlayerCombatTurn, handlePlayerCombatAttack, hideCheck, performManeuver, throwItem,
    throwScenery,
} from './player-actions.js';
import {
    closedDoorsNearParty, enterBoard, getActiveBoardContext, isBoardWon, stairsHere, threadBoardsHere,
    toggleBoardDoor,
} from './board.js';
import {
    lastWaiting, locationMapsManuallyHidden, renderLocationMapsPreview, setLocationMapsHidden,
} from './board-view.js';
import {
    currentSeason, ensureWorldData, getLocationBoards, hereLocation, lastRumors, lastWorldNpcs, lastWorldSeason,
    loadedWorldName,
} from './world.js';
import { friendlyFactions } from './factions.js';
import {
    advanceCampaignDay, campaignDay, getCampaignBonds, getCampaignCalendar, getCampaignMap,
    getCurrentSlotLabel, openWeekTable, spendDayPart, takeRest,
} from './time.js';
import { getPlot, openMilestones } from './plot.js';
import { refreshWorldMemoryPrompt } from './world-growth.js';
import { openGameMode, survivalNow } from './modes.js';
import {
    NARRATOR_FONTS, NARRATOR_HINTS, NARRATOR_LABELS, NARRATOR_MODES, applyColorblind, applyNarratorFont,
    narratorMode, offlineGame, postCombatNarration, retryLastReply, saverOn, showTip, storedNarratorMode,
    sucesosOn,
} from './narration.js';
import { openCompanionCard } from './companions.js';
import {
    askNarrator, askingNarrator, currentReplies, draftInChat, lookChips, namesInLastNarration, runSkillCheck,
    startTalk,
} from './talk.js';
import { askBeforeTravelling, campHere, neighbourPlaces, travelWithTime } from './travel.js';
import { buildServiceCards, rumorsLeftHere, runService, worldFestivals } from './town.js';
import {
    openTextMap, currentSessionLog, keepSessionLog, openSessionLog, openPartyGlance, openGlossary, openDiceHistory,
    openJournalSafely, openHelp, openWorkshop, shareWorld, openHowToPlay, openCampaignBuilder, openAudioSettings,
    exportCampaignPack, openHallOfFame, checkCurrentWorld, openCompendiumLibrary, openRules,
} from './menus.js';
import { lastMeter } from './events.js';
import { dayStripNow, peopleChips, townNow } from './social.js';

/** Los avisos del juego, guardados para la bandeja (idea 159). */
/** @type {import('../game-engine/ui/shell/notices.js').Notice[]} */
let notices = [];
/** Cuando se abrio la bandeja por ultima vez: lo de despues esta sin ver. */
let noticesSeenAt = 0;

/**
 * Idea 159: cada aviso del juego se guarda en la bandeja, y en pantalla nunca hay mas de
 * tres a la vez, para que no tapen los botones. Solo con el Modo Juego abierto: fuera,
 * SillyTavern avisa como siempre.
 */
function installNoticeTray() {
    const t = /** @type {any} */ (toastr);
    if (t.gameTrayInstalled) return;
    t.gameTrayInstalled = true;
    for (const kind of ['info', 'success', 'warning', 'error']) {
        const original = t[kind].bind(t);
        t[kind] = (/** @type {any} */ message, /** @type {any} */ title, /** @type {any} */ opts) => {
            const shown = original(message, title, opts);
            if (isShellOpen()) {
                notices = addNotice(notices, { kind, title: String(title ?? ''), message: String(message ?? ''), at: Date.now() });
                trimToasts();
                const badge = document.querySelector('.gs-tray-count');
                if (badge) badge.textContent = String(unseenCount(notices, noticesSeenAt) || '');
            }
            return shown;
        };
    }
}

/** Dejar a la vista solo los tres ultimos avisos. */
function trimToasts() {
    const shown = $('#toast-container .toast');
    if (shown.length <= MAX_VISIBLE_TOASTS) return;
    const newestOnTop = Boolean(/** @type {any} */ (toastr).options?.newestOnTop);
    (newestOnTop ? shown.slice(MAX_VISIBLE_TOASTS) : shown.slice(0, shown.length - MAX_VISIBLE_TOASTS)).remove();
}

/** La bandeja: los ultimos avisos, el mas nuevo arriba. */
function openNoticeTray() {
    const body = $('<div class="nt-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('Avisos'));
    if (notices.length === 0) body.append($('<div class="jr-item"></div>').text('Nada todavía.'));
    const now = Date.now();
    for (const notice of [...notices].reverse()) {
        const row = $('<div class="nt-row"></div>').addClass(`nt-${notice.kind}`).toggleClass('nt-new', notice.at > noticesSeenAt);
        const ago = Math.max(0, Math.round((now - notice.at) / 60000));
        row.append($('<div class="nt-head"></div>').text(`${notice.title || 'Aviso'}${notice.count > 1 ? ` ×${notice.count}` : ''}`
            + ` · ${ago === 0 ? 'ahora' : `hace ${ago} min`}`));
        if (notice.message) row.append($('<div class="nt-text"></div>').text(notice.message));
        body.append(row);
    }
    noticesSeenAt = now;
    if (isShellOpen()) refreshGameShell();
    void new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Lo que el motor sabe de la partida, para el director de escena.
 *
 * Ni una sola de estas respuestas viene del modelo: son el mundo cargado, el tablero
 * abierto y el encuentro en curso.
 *
 * @returns {import('../game-engine/ui/shell/scene-director.js').GameSituation}
 */
function buildShellSituation() {
    return {
        hasChat: Boolean(chat_metadata && chat_metadata[METADATA_KEY]),
        combatActive: Boolean(combatEncounter.active),
        boardName: currentBoardName || '',
        locationName: currentLocationName || '',
        hasWorldMap: Boolean(getCurrentWorldMapUrl()),
        // Cuantos sitios hay. Con uno solo no hay a donde viajar, y explorar no es una
        // escena: es una pestana que abre un mapa de un punto.
        placeCount: getCurrentWorldLocationMaps().length,
        // J18.7 y J18.8: el gremio y sus campañas se juegan sin chat y sin pestañas; la escena
        // cambia por lo que se hace. Y pasar a otro chat (a una campaña) es abrir partida.
        offline: offlineGame(),
        chatId: String(getCurrentChatId() ?? ''),
    };
}

/**
 * Lo que la barra de acciones necesita del turno en curso.
 *
 * @returns {import('../game-engine/ui/shell/game-shell.js').CombatBar}
 */
function buildShellCombatBar() {
    if (!combatEncounter.active) {
        return { active: false, round: 0, turnLabel: '', movement: '', isPlayerTurn: false, hasAction: false, targets: [], intents: [], canAuto: false };
    }

    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    const isPlayerTurn = Boolean(entry && !entry.isEnemy && member);
    const speed = Number(member?.speed) || 30;
    const remaining = member ? getRemainingMovementFeet(member) : 0;

    const targets = (isPlayerTurn ? getAttackableEnemiesForMember(member) : []).map(enemy => ({
        name: enemy.name,
        detail: `${getDistanceInFeet(member?.mapPosition?.gridX || 0, member?.mapPosition?.gridY || 0, enemy.gridX || 0, enemy.gridY || 0)} pies · PG ${enemy.currentHp}/${enemy.maxHp} · CA ${enemy.armorClass}`,
    }));

    return {
        active: true,
        round: Number(combatEncounter.round) || 1,
        turnLabel: entry ? `Turno de ${entry.name}` : 'Combate en curso',
        movement: isPlayerTurn ? `Movimiento: ${remaining}/${speed} pies` : '',
        isPlayerTurn,
        hasAction: isPlayerTurn && hasAction(combatEncounter, 'action'),
        targets,
        // Idea 14: a por quien va cada uno, para reaccionar antes.
        intents: buildEnemyIntents(),
        // Idea 18: el turno de un compañero lo puede jugar la maquina, con su postura.
        canAuto: isPlayerTurn && Boolean(member) && String(member?.id) !== String(partyMembers[0]?.id),
    };
}

/**
 * Lo que la escena de dialogo dibuja: quien habla, como esta el grupo y en que momento
 * del calendario va la partida.
 *
 * @returns {import('../game-engine/ui/shell/dialogue-scene.js').DialogueView}
 */
function buildShellDialogue() {
    return buildDialogueView({
        messages: chat,
        party: partyMembers,
        bonds: getCampaignBonds(),
        calendar: getCampaignCalendar(),
        xpTable: getXpTable(),
    });
}

/**
 * @param {number} [limit] Cuantas caben; sin decir, las de la fila.
 * @returns {import('../game-engine/ui/shell/action-chips.js').ActionChip[]}
 */
export function buildShellChips(limit = undefined) {
    // Si los datos del mundo son de otro, se releen y la fila se vuelve a dibujar.
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (worldName && worldName !== loadedWorldName) {
        void ensureWorldData().then(() => { if (isShellOpen()) refreshGameShell(); });
    }
    const location = currentLocationName
        ? getCurrentWorldLocationMaps().find(l => l.name === currentLocationName)
        : null;

    return buildActionChips({
        fighting: combatEncounter.active,
        hasBoard: Boolean(currentBoardName),
        doors: closedDoorsNearParty(),
        // Con los muertos no se habla (idea 36).
        // Con los compañeros: el primero es quien juega, y hablar consigo mismo no es hablar.
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => ({ name: m.name })),
        mentioned: namesInLastNarration(),
        // Se viaja a los vecinos: una ficha a la otra punta del mapa sería un salto.
        places: neighbourPlaces().map(name => ({ name })),
        // Los tableros de aquí que pide la historia: sus fichas van delante.
        thread: threadBoardsHere(location),
        // Los que quedan por ganar, delante: caben dos, y un tablero ya ganado escondía el
        // siguiente (en Barovia, el Sótano detrás de la Taberna).
        boards: getLocationBoards(location)
            .map((/** @type {any} */ b) => ({ name: String(b.name), won: isBoardWon(currentLocationName, String(b.name)) }))
            .sort((a, b) => Number(a.won) - Number(b.won))
            .map(b => ({ name: b.name })),
        hurt: partyMembers.some(m => !m.dead && (Number(m.hp) || 0) < (Number(m.maxHp) || 0)),
        // Cuantos dados quedan sale del nivel y de los ya gastados; las caras las
        // lee el descanso, que puede esperar al Lorebook porque es asincrono.
        hitDice: availableHitDice(partyMembers),
        rumors: rumorsLeftHere(),
        forage: Boolean(currentLocationName) && !currentBoardName && forageCheck(hereLocation() ?? {}).allowed,
        explore: Boolean(currentLocationName) && !currentBoardName
            && canExplore(getCurrentWorldLocationMaps(), []),
        proposals: readProposals(chat_metadata?.[PROPOSALS_KEY]).map(p => ({ name: p.name })),
        ...(limit !== undefined ? { limit } : {}),
        // Idea 151: con quien se puede hablar aqui, ademas de los tuyos.
        people: lastWorldNpcs
            .filter(n => !n.dead && n.where.toLowerCase() === String(currentLocationName).toLowerCase())
            .map(n => ({ name: n.name })),
        // Idea 139: lo que ofrece el narrador.
        // Z3: y lo que el sitio deja examinar, sin que nadie lo ofrezca.
        extras: [...offerChips(chat_metadata?.[OFFERS_KEY]), ...lookChips()],
        // Idea 67: acampar donde no hay posada.
        camp: Boolean(currentLocationName) && !currentBoardName && campHere().ok,
        // Idea 75: la escalera al nivel siguiente.
        stairs: Boolean(stairsHere()),
        // Idea 7: los prisioneros, con lo que se puede hacer con ellos aqui.
        prisoners: prisonerChips(chat_metadata?.[PRISONERS_KEY], {
            authority: Boolean(location) && servicesOf(location).some(sv => sv === 'tablon' || sv === 'templo'),
            fighting: combatEncounter.active,
        }),
        // Idea 137: lo que estas escribiendo pide una tirada.
        typed: typedIntents.map(skill => ({ skill, label: SKILLS[/** @type {keyof typeof SKILLS} */ (skill)]?.label ?? skill })),
        // Idea 144: lo que se le puede decir a quien se está hablando. Sin conexión, solo lo que
        // hace algo al pulsarlo: las que dejaban la frase empezada en la caja, sin caja, no (J18.7).
        replies: offlineGame() ? currentReplies().filter(r => r.command || r.id === 'reply-bye') : currentReplies(),
        // J4: el tablón de campañas y los mercenarios en el gremio; volver, en una campaña.
        hub: hubChips(),
        // Los que esperan en el tablero: la pelea se empieza también desde la fila.
        fight: !combatEncounter.active && lastWaiting.board === currentBoardName && lastWaiting.placements.length > 0
            && !isBoardWon(currentLocationName, currentBoardName)
            ? waitingSummary(lastWaiting.placements) : '',
        requests: readRequests(chat_metadata?.[CHECK_REQUESTS_KEY], SKILLS).map(r => ({
            skill: r.skill, label: SKILLS[/** @type {keyof typeof SKILLS} */ (r.skill)].label, reason: r.reason, dc: r.dc,
        })),
        // J2.1: el tablero abierto, para que el que pide la historia salga también desde otro
        // de aquí (del muelle a la bodega, sin salir antes).
        board: currentBoardName || '',
        // J14: la charla que espera, quedar con alguien y charlar con quien está aquí.
        social: peopleChips(),
    });
}

/**
 * Lo que hace pulsar una ficha.
 *
 * Una que abre una puerta gasta — puede despertar una sala — y por eso es un boton. La
 * de hablar solo deja la frase empezada en el chat: lo que se diga lo escribe quien juega,
 * y enviarlo por el es ponerle palabras en la boca.
 *
 * @param {import('../game-engine/ui/shell/action-chips.js').ActionChip} chip
 */
export function runShellChip(chip) {
    // Idea 144: hablar con alguien de aquí abre sus respuestas; despedirse las cierra. Y la
    // fila se redibuja en el acto, detrás de la frase empezada: si no, las respuestas no
    // salían hasta que pasara otra cosa.
    if (chip.id.startsWith('talk-local:') || chip.id === 'reply-bye') {
        setTalkingTo(chip.id === 'reply-bye' ? '' : chip.id.slice('talk-local:'.length));
        if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
    }
    // Hablar con alguien cuenta al pulsar, no al enviar: sin modelo no se envía nada, y el
    // hilo se quedaba esperando (ROADMAP_SIN_TOKENS, Z0).
    const talkTo = chip.id.startsWith('talk-local:') ? chip.id.slice('talk-local:'.length)
        : chip.id.startsWith('talk:') ? chip.id.slice('talk:'.length) : '';
    if (talkTo) {
        startTalk(talkTo, String(chip.draft || ''));
        return;
    }
    // Idea 169: las que no cabian en la fila.
    if (chip.id === 'more') {
        openAllChips();
        return;
    }
    if (chip.id === 'fight-board') {
        if (lastWaiting.board === currentBoardName) startWaitingFight(lastWaiting.placements);
        return;
    }
    // Idea 137: tirar por lo que se esta escribiendo, sin borrarlo.
    if (chip.id.startsWith('typed:')) {
        const input = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        runSkillCheck(chip.id.slice('typed:'.length), String(input?.value ?? ''));
        setTypedIntents([]);
        if (isShellOpen()) refreshGameShell();
        return;
    }
    if (chip.cell) {
        const context = getActiveBoardContext();
        if (!context.board) return;
        toggleBoardDoor(context.board, chip.cell.x, chip.cell.y, true, context.gridWidth, context.gridHeight);
        return;
    }

    if (chip.command) {
        // Importado aqui y no arriba a proposito: `slash-commands.js` carga `script.js`,
        // que carga este archivo. Traerlo al cargar cambiaria ese orden, y lo que la
        // ficha necesita es ejecutar lo mismo que si se escribiera, no antes.
        void import('../slash-commands.js').then(m => m.executeSlashCommandsWithOptions(chip.command));
        return;
    }

    // Sin conexión no hay caja donde dejarla (J18.7).
    if (chip.draft && !offlineGame()) draftInChat(chip.draft);
}

/** Idea 169: todas las fichas, en una ventana. */
function openAllChips() {
    const chips = buildShellChips(Infinity);
    const body = $('<div class="hp-root"></div>');
    body.append($('<h3></h3>').text('Todo lo que se puede hacer'));
    /** @type {Popup|null} */
    let popup = null;
    for (const chip of chips) {
        const row = $('<button type="button" class="menu_button hp-item"></button>').attr('data-chip', chip.id);
        row.append($('<span class="hp-label"></span>').text(chip.label));
        row.on('click', () => {
            void popup?.completeCancelled();
            runShellChip(chip);
        });
        body.append(row);
    }
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true });
    void popup.show();
}

/**
 * Lo que dibuja la escena de exploracion.
 *
 * @returns {import('../game-engine/ui/shell/exploration-scene.js').ExplorationView}
 */
function buildShellExploration() {
    const view = buildExplorationView({
        locationMaps: getCurrentWorldLocationMaps(),
        campaignMap: getCampaignMap(),
        currentLocation: currentLocationName,
        currentBoard: currentBoardName,
        party: partyMembers,
        bonds: getCampaignBonds(),
        calendar: getCampaignCalendar(),
        xpTable: getXpTable(),
        travel: { friendly: friendlyFactions(), season: currentSeason(), done: readPlotState(chat_metadata?.[PLOT_STATE_KEY]).done },
    });
    // Idea 81: lo pendiente en cada sitio, para decidir adonde ir.
    /** @type {Record<string, number>} */
    const unheard = {};
    const heardIds = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    for (const rumor of lastRumors) {
        if (heardIds.includes(rumor.id)) continue;
        unheard[rumor.where] = (unheard[rumor.where] ?? 0) + 1;
    }
    const pending = pendingByPlace({
        places: view.places.map(p => p.name),
        board: chat_metadata?.[BOARD_KEY] ?? [],
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        rumors: unheard,
        thread: openMilestones().map(m => String(m?.asks?.place ?? '')).filter(Boolean),
    });
    // Idea 89: la fiesta que se acerca, en la lista de viaje.
    const festivals = worldFestivals();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const soon = (/** @type {string} */ name) => {
        const festival = festivals[name];
        if (!festival) return '';
        const left = daysUntil(festival, today);
        return left === 0 ? `hoy, ${festival.name}` : left <= 3 ? `${festival.name} en ${left} día${left === 1 ? '' : 's'}` : '';
    };
    // Idea 85: como le va a este sitio por lo que hicisteis.
    return {
        ...view,
        places: view.places.map(p => ({
            ...p,
            pending: [pending[p.name] ?? '', soon(p.name) ? `Fiesta: ${soon(p.name)}` : ''].filter(Boolean).join(' · '),
        })),
        fortune: fortuneLine(hereLocation()),
    };
}

/**
 * J0.6: campaigns.js, para leer las partidas guardadas sin esperar. Lo trae la portada; se
 * pide sin import estático, que campaigns.js ya importa de aquí.
 * @type {typeof import('../campaigns.js')|null}
 */
let savedGamesApi = null;

/**
 * @returns {import('../game-engine/ui/shell/game-shell.js').ShellOptions}
 */
function buildShellOptions() {
    installNoticeTray();
    applyColorblind();
    if (!savedGamesApi) {
        void import('../campaigns.js').then(m => {
            savedGamesApi = m;
            if (isShellOpen()) refreshGameShell();
        });
    }
    // J0.4: el tamaño y la velocidad del texto, de este navegador.
    void import('../game-engine/ui/game-options.js').then(({ applyTextOptions }) => applyTextOptions());
    // El panel podia estar plegado antes de encender el Shell, y apagarlo tiene que
    // dejarlo como estaba: el Shell lo despliega porque es su escenario, no porque el
    // jugador lo pidiera.
    const wasHidden = locationMapsManuallyHidden;
    return {
        getSituation: buildShellSituation,
        getCombatBar: buildShellCombatBar,
        getDialogue: buildShellDialogue,
        // J18.4: el narrador cuenta, no se pinta en la novela visual.
        narratorName: () => String(name2 || ''),
        getExploration: buildShellExploration,
        // El reloj: el mismo calendario y los mismos descansos que la pestana de
        // Campana, pero dentro de la partida. Ver ROADMAP_JUEGO_SIN_COMANDOS.md, K3.
        getClock: () => buildClockView({
            day: Number(getCampaignCalendar()?.day) || 1,
            slotLabel: getCurrentSlotLabel(),
            fighting: combatEncounter.active,
            party: partyMembers,
            // Idea 74: la estación, y lo que le queda.
            season: chat_metadata?.[METADATA_KEY] ? describeSeason(Math.max(1, campaignDay()), lastWorldSeason || undefined) : '',
            // J14.2: las partes del día, con lo que se hizo en cada una.
            strip: chat_metadata?.[METADATA_KEY] ? dayStripNow() : [],
        }),
        // J3.11: la localización de aquí y su gente, sin leer el mundo cada 15 s; y J14.4, quién
        // de tu gente está en cada sitio.
        getTown: () => townNow(),
        getChips: buildShellChips,
        onChip: runShellChip,
        getChecks: () => (combatEncounter.active || !partyMembers[0]
            ? []
            : checkOptions(partyMembers[0], { locked: Boolean(chat_metadata?.[PENDING_CHECK_KEY]) })),
        onCheck: (skill) => { runSkillCheck(skill); },
        onAskNarrator: () => askNarrator(),
        isAskingNarrator: () => askingNarrator,
        // Sin conexión no hay narrador a quien escribirle (J18.7).
        canAskNarrator: () => !offlineGame() && !combatEncounter.active && Boolean(partyMembers[0]),
        getFocus: () => focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay()),
        onJournal: () => openJournalSafely(),
        onGlance: () => openPartyGlance(),
        getNoticeCount: () => unseenCount(notices, noticesSeenAt),
        onTray: () => openNoticeTray(),
        getMeter: () => lastMeter,
        onMeter: () => { void import('../game-engine/ui/prompt-preview.js').then(m => m.openPromptPreview({ Popup, POPUP_TYPE })); },
        onHelp: () => openHelp(),
        getServices: () => buildServiceCards(),
        onService: (actionId) => { void runService(actionId); },
        onCompanion: (memberId) => openCompanionCard(memberId),
        onClock: (action) => {
            // J14.2: pasar el rato también se apunta en la cabecera.
            if (action === 'slot') spendDayPart('rato', { label: 'Pasar el rato' });
            else if (action === 'day') advanceCampaignDay();
            else void takeRest(action === 'short' ? 'corto' : 'largo');
        },
        onEnterBoard: (name) => { enterBoard(name); renderLocationMapsPreview(); },
        // Un clic nunca gasta nada; lo gasta el boton que lo confirma. Y viajar gasta
        // dias, comida y la cuenta de la semana, asi que primero se dice lo que cuesta.
        onTravel: (name) => {
            void travelWithTime(name, { confirm: askBeforeTravelling })
                .then(({ reason }) => {
                    // Cancelar no lleva motivo: solo se avisa de lo que impide viajar.
                    if (reason) toastr.info(reason, 'No se puede viajar');
                    renderLocationMapsPreview();
                });
        },
        // Los paneles de SillyTavern se abren donde estan: en pausa su barra vuelve
        // arriba, por encima de esta capa, y el boton pulsa el mismo icono de siempre.
        // J0.4: las opciones del juego. Los ajustes de SillyTavern, al fondo y con conexión.
        onOptions: () => { void openGameOptionsPanel(); },
        onRules: () => { void openRules(); },
        onCompendium: () => { void openCompendiumLibrary(); },
        // Idea 181: el comprobador de densidad, desde la partida.
        onCheckWorld: () => { void checkCurrentWorld(); },
        // Idea 199: los caídos de todas las partidas.
        countHall: () => readHall(/** @type {any} */ (extension_settings).partyHall).length,
        // J3.9: «1 campaña terminada · 2 caídos».
        hallHint: () => describeHallCount(/** @type {any} */ (extension_settings).partyHall),
        onHall: () => { openHallOfFame(); },
        onEditCampaign: () => { void openCampaignBuilder(); },
        // El asistente de campana vive en la pantalla de bienvenida, que viaja dentro del
        // chat adoptado: pulsar su boton es pulsar el que ya existe.
        onNewCampaign: () => {
            const button = document.querySelector('#cw-new-campaign');
            if (button instanceof HTMLElement) button.click();
            else toastr.info('Abre "Nueva campana" desde la lista de partidas.');
        },
        // J4: jugar sin conexión, con los botones del bloque de la lista de partidas.
        onOffline: () => {
            const button = document.querySelector('#hub-new-game');
            if (button instanceof HTMLElement) button.click();
            else toastr.info('Espera a que cargue la lista de partidas.');
        },
        // J0.5 y J0.6: las partidas guardadas, «Continuar» y «Cargar partida». Las lee
        // campaigns.js con la lista de la portada; aquí solo se piden.
        getGames: () => savedGamesApi?.savedGameCards() ?? null,
        onLoadGame: (id) => { void import('../campaigns.js').then(m => m.continueSavedGame(id)); },
        onDeleteGame: (id) => { void import('../campaigns.js').then(m => m.deleteSavedGame(id)); },
        getAutostart: () => shouldAutostartGameShell(),
        setAutostart: (value) => {
            setGameShellAutostart(value);
            toastr.info(value
                ? 'El juego se abrira solo la proxima vez.'
                : 'La proxima vez arranca el SillyTavern de siempre. Vuelve con /modojuego.');
        },
        onExport: () => { void exportCampaignPack(); },
        onAudio: () => { void openAudioSettings(); },
        // Salir al menu principal es cerrar la partida, no cerrar el juego: el Shell se
        // queda, y lo que se ve es la pantalla de bienvenida con las campanas.
        onMainMenu: () => { $('#option_close_chat').trigger('click'); },
        renderStage: () => renderLocationMapsPreview(),
        onAttack: (name) => handlePlayerCombatAttack(name),
        onEndTurn: () => { void confirmEndTurn(); },
        onAutoTurn: () => {
            const entry = getCurrentTurnEntry();
            if (!entry || entry.isEnemy || !combatEncounter.active) return;
            postCombatNarration(resolveAllyTurnAction(entry));
            if (combatEncounter.active) endPlayerCombatTurn();
            renderLocationMapsPreview();
        },
        onDice: () => openDiceHistory(),
        onGlossary: () => openGlossary(),
        // J2.2: el de la pelea sale al empezar la primera, no al abrir el tablero.
        onScene: (scene) => { if (!MOMENT_TIPS.includes(scene)) showTip(scene); },
        // U0 del pegamento: el diario de sesión.
        onSceneTime: (scene) => keepSessionLog(enterScene(currentSessionLog(), scene, Date.now())),
        onSession: () => { void openSessionLog(); },
        onHowToPlay: () => { void openHowToPlay(); },
        // U5 del pegamento: la semana en una mesa.
        onWeekTable: () => { void openWeekTable(); },
        // Ideas 69 y 70: el mapa en texto.
        onTextMap: () => { void openTextMap(); },
        // Idea 187: en un sitio sin tablero, la música del pueblo.
        audioSceneFor: (scene) => (scene === 'exploration' && !currentBoardName && !combatEncounter.active ? 'town' : scene),
        getToggles: () => [
            // R1: el modo, arriba del todo. Pulsarlo abre el selector.
            { id: 'mode', label: `Modo: ${describeGameMode(survivalNow())}`, on: true },
            // R5: la mascota.
            { id: 'pet', label: currentPet() ? `Mascota: ${petName(/** @type {any} */ (currentPet()))}` : 'Mascota: ninguna', on: Boolean(currentPet()) },
            { id: 'saver', label: saverOn() ? 'Modo ahorro: encendido' : 'Modo ahorro: apagado', on: saverOn() },
            // Z6 de ROADMAP_SIN_TOKENS: quién cuenta (y cuánto se gasta), y si salen sucesos.
            {
                id: 'narrator',
                label: `Narrador: ${NARRATOR_LABELS[/** @type {keyof typeof NARRATOR_LABELS} */ (storedNarratorMode())]}${online_status === 'no_connection' && storedNarratorMode() !== 'motor' ? ' (sin conexión: Motor)' : ''}`,
                on: storedNarratorMode() !== 'modelo',
            },
            { id: 'sucesos', label: sucesosOn() ? 'Sucesos con decisión: sí' : 'Sucesos con decisión: no', on: sucesosOn() },
            { id: 'length', label: `Largo de la narración: ${LENGTHS[/** @type {keyof typeof LENGTHS} */ (String(chat_metadata?.[LENGTH_KEY] || 'ficha'))]?.label ?? 'Lo de su ficha'}`, on: Boolean(chat_metadata?.[LENGTH_KEY]) },
            { id: 'colorblind', label: localFlag.get(COLORBLIND_KEY) === '1' ? 'Colores para daltonismo: sí' : 'Colores para daltonismo: no', on: localFlag.get(COLORBLIND_KEY) === '1' },
            // Idea 195: la letra del narrador, de la campaña.
            { id: 'font', label: `Letra del narrador: ${(NARRATOR_FONTS.find(f => f.id === String(chat_metadata?.[NARRATOR_FONT_KEY] || '')) ?? NARRATOR_FONTS[0]).label}`, on: Boolean(chat_metadata?.[NARRATOR_FONT_KEY]) },
            // Idea 142: el tono de la escena.
            { id: 'tone', label: describeTone(chat_metadata?.[TONE_KEY]), on: readTone(chat_metadata?.[TONE_KEY]) !== 'auto' },
            // Ideas 25 y 29: la red de seguridad, y que los hartos se vayan.
            { id: 'safety', label: chat_metadata?.[SAFETY_ON_KEY] ? 'Red de seguridad: sí' : 'Red de seguridad: no', on: Boolean(chat_metadata?.[SAFETY_ON_KEY]) },
            { id: 'leave', label: chat_metadata?.[LEAVE_ON_KEY] ? 'Los hartos se van: sí' : 'Los hartos se van: no', on: Boolean(chat_metadata?.[LEAVE_ON_KEY]) },
            // U5 (DU4): la mesa se abre sola la primera vez; luego, con aviso, salvo que se quiera siempre.
            { id: 'mesa', label: chat_metadata?.[WEEK_TABLE_AUTO_KEY] ? 'La mesa cada semana: se abre sola' : 'La mesa cada semana: con aviso', on: Boolean(chat_metadata?.[WEEK_TABLE_AUTO_KEY]) },
        ],
        onToggle: (id) => {
            if (id === 'mode') {
                void openGameMode();
                return;
            }
            if (id === 'pet') {
                void openPetPanel();
                return;
            }
            if (id === 'narrator') {
                const next = NARRATOR_MODES[(NARRATOR_MODES.indexOf(storedNarratorMode()) + 1) % NARRATOR_MODES.length];
                try {
                    localStorage.setItem(NARRATOR_MODE_STORAGE, next);
                } catch { /* sin almacenamiento, se queda como estaba */ }
                toastr.info(NARRATOR_HINTS[/** @type {keyof typeof NARRATOR_HINTS} */ (next)], `Narrador: ${NARRATOR_LABELS[/** @type {keyof typeof NARRATOR_LABELS} */ (next)]}`);
            } else if (id === 'sucesos') {
                try {
                    localStorage.setItem(SUCESOS_STORAGE, sucesosOn() ? 'off' : 'on');
                } catch { /* sin almacenamiento, se queda como estaba */ }
            } else if (id === 'saver') localFlag.set(SAVER_KEY, saverOn() ? '' : '1');
            else if (id === 'colorblind') {
                localFlag.set(COLORBLIND_KEY, localFlag.get(COLORBLIND_KEY) === '1' ? '' : '1');
                applyColorblind();
            } else if (id === 'font' && chat_metadata) {
                const at = NARRATOR_FONTS.findIndex(f => f.id === String(chat_metadata[NARRATOR_FONT_KEY] || ''));
                chat_metadata[NARRATOR_FONT_KEY] = NARRATOR_FONTS[(at + 1) % NARRATOR_FONTS.length].id;
                saveMetadata();
                applyNarratorFont();
            } else if (id === 'length' && chat_metadata) {
                const next = nextLength(String(chat_metadata[LENGTH_KEY] || 'ficha'));
                chat_metadata[LENGTH_KEY] = next === 'ficha' ? '' : next;
                saveMetadata();
            } else if (id === 'tone' && chat_metadata) {
                chat_metadata[TONE_KEY] = nextTone(chat_metadata[TONE_KEY]);
                saveMetadata();
            } else if (id === 'mesa' && chat_metadata) {
                chat_metadata[WEEK_TABLE_AUTO_KEY] = !chat_metadata[WEEK_TABLE_AUTO_KEY];
                saveMetadata();
            } else if ((id === 'safety' || id === 'leave') && chat_metadata) {
                const key = id === 'safety' ? SAFETY_ON_KEY : LEAVE_ON_KEY;
                chat_metadata[key] = !chat_metadata[key];
                saveMetadata();
            }
            refreshWorldMemoryPrompt();
        },
        // Idea 180: el código del mundo.
        onShareWorld: () => { void shareWorld(); },
        // Ideas 175, 176, 183 y 185: el taller del mundo.
        onWorkshop: () => { void openWorkshop(); },
        onRetry: (mode) => { void retryLastReply(mode); },
        canRetry: () => narratorMode() !== 'motor',
        onFlee: () => { void retreatFromCombat(); },
        onClose: () => setLocationMapsHidden(wasHidden),
        getAbilities: () => {
            const member = getCurrentActingMember();
            if (!member || !combatEncounter.active) return [];
            // J19: con sus conjuros de 5e, si lanza con espacios.
            return knownAbilitiesOf(member)
                .filter(ability => ability.target !== 'enemy' && ability.combat !== false)
                .map(ability => {
                    const verdict = canUseAbility({
                        member,
                        ability,
                        hasAction: hasAction(combatEncounter, 'action'),
                        hasBonus: hasAction(combatEncounter, 'bonus'),
                        carried: carriedNames(),
                    });
                    const left = usesLeft(member, ability);
                    return {
                        id: ability.id,
                        label: Number.isFinite(left) ? `${ability.name} (${left})` : ability.name,
                        detail: verdict.ok ? describeAbility(ability) : verdict.reason,
                        enabled: verdict.ok,
                        needsAlly: ability.target === 'ally',
                        allies: ability.target === 'ally'
                            ? partyMembers
                                .filter(m => (Number(m.hp) || 0) > 0)
                                .map(m => ({ id: String(m.id), name: `${m.name} (${m.hp}/${m.maxHp})` }))
                            : [],
                    };
                });
        },
        onAbility: (abilityId, allyId) => {
            const member = getCurrentActingMember();
            const ability = getAbilityCatalogue().find(a => a.id === abilityId);
            if (!member || !ability) return;
            const ally = allyId ? partyMembers.find(m => String(m.id) === String(allyId)) : null;
            useAbility(member, ability, ability.target === 'ally' ? ally : null);
        },
        getManeuvers: () => {
            const member = getCurrentActingMember();
            if (!member || !combatEncounter.active) return [];
            const x = Number(member.mapPosition?.gridX) || 0;
            const y = Number(member.mapPosition?.gridY) || 0;
            const enemies = getAliveEnemies().map((/** @type {any} */ e) => ({
                id: String(e.instanceId),
                name: String(e.name),
                distanceFeet: getDistanceInFeet(x, y, Number(e.gridX) || 0, Number(e.gridY) || 0),
            }));
            // Idea 8: lo que hay a mano en el tablero, si hay algo al lado.
            const board8 = getActiveBoardContext();
            const scenery = judgeSceneryThrow({
                near: sceneryNear(board8.terrain, x, y, board8.gridWidth, board8.gridHeight),
                hasAction: hasAction(combatEncounter, 'action'),
                enemies,
            });
            return [
                ...judgeManeuvers({ hasAction: hasAction(combatEncounter, 'action'), enemies, hide: hideCheck(member) }),
                // Idea 122: lo que lleva para lanzar, con la misma forma que una maniobra.
                ...judgeThrows({ member, hasAction: hasAction(combatEncounter, 'action'), enemies }),
                ...(scenery ? [scenery] : []),
                // R4: los pergaminos y las varitas, con la misma forma.
                ...judgeMagicItems({
                    member,
                    hasAction: hasAction(combatEncounter, 'action'),
                    enemies,
                    allies: partyMembers.filter(m => (Number(m.hp) || 0) > 0).map(m => ({
                        id: String(m.id), name: String(m.name),
                        distanceFeet: getDistanceInFeet(x, y, Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0),
                    })),
                    abilityOf: (id) => getAbilityCatalogue().find(a => a.id === id),
                }),
            ];
        },
        onManeuver: (maneuverId, targetId) => {
            if (String(maneuverId).startsWith('leer:')) useMagicItem(String(maneuverId).slice('leer:'.length), targetId);
            else if (maneuverId === 'lanzar:objeto') throwScenery(targetId);
            else if (String(maneuverId).startsWith('lanzar:')) throwItem(String(maneuverId).slice('lanzar:'.length), targetId);
            else performManeuver(maneuverId, targetId);
        },
        onObjectives: () => {
            const verdict = judgeCurrentScenario();
            toastr.info(
                verdict ? verdict.summary : 'Este tablero no tiene objetivos: gana quien limpie el tablero.',
                'Objetivos', { timeOut: 10000 },
            );
        },
    };
}

/**
 * J0.4 de ROADMAP_SIN_CONEXION: las opciones del juego, en su ventana y con sus palabras.
 * Lo de este navegador; lo de cada partida (el tono, la red de seguridad…) sigue en la pausa.
 *
 * @returns {Promise<void>}
 */
async function openGameOptionsPanel() {
    const { openGameOptions, textOptions, cycleTextOption } = await import('../game-engine/ui/game-options.js');
    const { loadAudioSettings } = await import('../game-engine/ui/shell/scene-audio.js');
    // Sin proveedor, o en una partida del gremio (se juega sin conexión aunque lo haya).
    const offline = () => online_status === 'no_connection' || offlineGame();
    const yes = (/** @type {boolean} */ on) => (on ? 'Sí' : 'No');
    const rows = () => {
        const text = textOptions();
        return [
            // El modo es de la partida: solo con una abierta.
            ...(currentLocationName ? [{ id: 'mode', icon: 'fa-skull', label: 'Modo de juego', value: describeGameMode(survivalNow()), hint: 'Cuánto duele caer, en esta partida' }] : []),
            {
                id: 'narrator', icon: 'fa-feather', label: 'Quién cuenta',
                value: offline() ? 'El juego (sin conexión)' : NARRATOR_LABELS[/** @type {keyof typeof NARRATOR_LABELS} */ (storedNarratorMode())],
                hint: offline() ? 'Jugando sin conexión, lo cuenta siempre el juego' : 'El juego, el modelo o los dos',
            },
            { id: 'sucesos', icon: 'fa-signs-post', label: 'Sucesos con decisión', value: yes(sucesosOn()), hint: 'Cosas que pasan por el camino y piden decidir' },
            { id: 'size', icon: 'fa-text-height', label: 'Tamaño del texto', value: text.size.label },
            { id: 'speed', icon: 'fa-gauge', label: 'Velocidad del texto', value: text.speed.label, hint: 'Cómo aparece lo que se cuenta en la caja' },
            { id: 'colorblind', icon: 'fa-eye-low-vision', label: 'Colores para daltonismo', value: yes(localFlag.get(COLORBLIND_KEY) === '1') },
            { id: 'audio', icon: 'fa-music', label: 'Sonido', value: loadAudioSettings().enabled ? 'Encendido' : 'Apagado', hint: 'La música de cada escena y los golpes' },
            { id: 'autostart', icon: 'fa-door-open', label: 'Abrir el juego al entrar', value: yes(shouldAutostartGameShell()) },
            ...(offline() ? [] : [{ id: 'saver', icon: 'fa-piggy-bank', label: 'Modo ahorro', value: yes(saverOn()), hint: 'Gasta menos del modelo' }]),
        ];
    };
    await openGameOptions({
        Popup, POPUP_TYPE, rows,
        onPick: async (id) => {
            if (id === 'mode') await openGameMode();
            else if (id === 'audio') await openAudioSettings();
            else if (id === 'size' || id === 'speed') cycleTextOption(id);
            else if (id === 'autostart') setGameShellAutostart(!shouldAutostartGameShell());
            else if (id === 'narrator') {
                if (offline()) {
                    toastr.info('Jugando sin conexión cuenta el juego. En una partida con modelo se puede elegir.', 'Quién cuenta');
                    return;
                }
                const next = NARRATOR_MODES[(NARRATOR_MODES.indexOf(storedNarratorMode()) + 1) % NARRATOR_MODES.length];
                try {
                    localStorage.setItem(NARRATOR_MODE_STORAGE, next);
                } catch { /* sin almacenamiento, se queda como estaba */ }
            } else if (id === 'sucesos') {
                try {
                    localStorage.setItem(SUCESOS_STORAGE, sucesosOn() ? 'off' : 'on');
                } catch { /* sin almacenamiento, se queda como estaba */ }
            } else if (id === 'colorblind') {
                localFlag.set(COLORBLIND_KEY, localFlag.get(COLORBLIND_KEY) === '1' ? '' : '1');
                applyColorblind();
            } else if (id === 'saver') localFlag.set(SAVER_KEY, saverOn() ? '' : '1');
            refreshWorldMemoryPrompt();
        },
        onAdvanced: offline() ? null : () => { $('#ai-config-button .drawer-toggle').trigger('click'); },
    });
    refreshGameShell();
}

/** @returns {boolean} */
function shouldAutostartGameShell() {
    try {
        return window.localStorage.getItem(GAME_SHELL_AUTOSTART_KEY) !== 'false';
    } catch {
        return true;
    }
}

/** @param {boolean} value */
function setGameShellAutostart(value) {
    try {
        window.localStorage.setItem(GAME_SHELL_AUTOSTART_KEY, String(Boolean(value)));
    } catch (error) {
        console.warn('[party] no se pudo guardar el arranque del Modo Juego', error);
    }
}

/**
 * Abre el Modo Juego al arrancar, si toca.
 *
 * No decide **que** pantalla: eso es del director. Sin campana abierta cae en el titulo,
 * y con una campana a medias te deja donde lo dejaste — que es lo que uno espera de un
 * juego al que vuelve.
 */
export function autostartGameShell() {
    if (!shouldAutostartGameShell() || isShellOpen()) return;

    const shellOptions = buildShellOptions();
    setLocationMapsHidden(false);
    toggleGameShell(shellOptions);
}

/**
 * Enciende o apaga el Modo Juego.
 *
 * Al encenderlo se abre el panel de localizacion aunque estuviera plegado: el Shell no
 * tiene otra cosa que poner en el escenario, y una pantalla completa vacia no se
 * entiende.
 *
 * @returns {string}
 */
export function toggleGameMode() {
    if (isShellOpen()) {
        closeGameShell();
        return 'modo juego apagado';
    }

    // Las opciones primero: guardan si el panel estaba plegado, y desplegarlo antes
    // haria que el Shell lo "restaurara" siempre desplegado al apagarse.
    const shellOptions = buildShellOptions();
    setLocationMapsHidden(false);
    toggleGameShell(shellOptions);
    return 'modo juego encendido';
}
