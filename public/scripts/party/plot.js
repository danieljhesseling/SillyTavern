/**
 * El hilo de la campaña: la mecha, los pasos y los actos, las pistas, el villano, los sitios
 * que se revelan y el final.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, refreshWorldMapGlobals, getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import { companionEpilogues } from '../game-engine/campaign/epilogues.js';
import { endingEpilogues, partyAtStart, readPartyStart, takeHome } from '../game-engine/campaign/campaign-end.js';
import { readVillain, villainScenesDue, villainNote } from '../game-engine/campaign/villain.js';
import { summarizeAct, hideRange, addSummary } from '../game-engine/campaign/act-summary.js';
import { notForHero } from '../game-engine/campaign/hero-fit.js';
import { readGraves } from '../game-engine/campaign/legacy.js';
import { SKILLS } from '../game-engine/rules/checks.js';
import { dueHints } from '../game-engine/campaign/guidance.js';
import { listNames } from '../game-engine/campaign/engine-narrator.js';
import { resolveGenderDeep } from '../game-engine/campaign/grammar.js';
import { chronicleOf } from '../game-engine/campaign/chronicle.js';
import {
    readPlot, startPlot, plotEvent, focusOf, describeFocus, plotFromFaction, chooseEnding, actOf, visibleOpen,
    secretsOf, readPlotState,
} from '../game-engine/campaign/plot.js';
import { withJob } from '../game-engine/campaign/company.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { attitudeBonus } from '../game-engine/campaign/attitudes.js';
import {
    stepScenes, rememberScene, sceneTranscript, applySceneEffects,
} from '../game-engine/campaign/plot-scenes.js';
import { dialogueMilestones } from '../game-engine/campaign/dialogues.js';
import { describeLootItem } from '../game-engine/combat/loot-items.js';
import { openPlotScene } from '../game-engine/ui/plot-scene.js';
import { sceneFollows, dialogueFollow, scheduleFollows, laterRows, checkLaters } from '../game-engine/campaign/aftermath.js';
import { readSucesoState } from '../game-engine/campaign/sucesos.js';
import { opinionsOn, opinionBadges, opinionNotes, verdictsOf, importantOption } from '../game-engine/campaign/companion-opinions.js';
import { readCompanionCards } from '../game-engine/campaign/companion-cards.js';
import { weightyMilestones, actionNoReturn, noReturnConfirm } from '../game-engine/campaign/weighty.js';
import {
    recordDecisions, sceneDecisionEntries, buildStoryBook, bookInputFromMetadata, guildChapterLine, focusClock,
} from '../game-engine/campaign/story-book.js';
import { HUB_BOARD_NAME_KEY } from '../game-engine/campaign/hub.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { addItemToInventory, createItem, removeItemFromInventory } from '../dnd-system.js';
import { rollDiceDetailed } from './combat-rules.js';
import {
    ACT_STARTS_KEY, ACT_SUMMARIES_KEY, ATTITUDES_KEY, CAMPAIGN_START_KEY, DIALOGUE_MEMORY_KEY, GRAVES_KEY, HERO_FIT_KEY,
    HINTS_KEY, PLOT_ANNOUNCED_KEY, PLOT_DECISIONS_KEY, PLOT_KEY, PLOT_SCENES_PLAYED_KEY, PLOT_STATE_KEY, RUMORS_HEARD_KEY,
    RUMORS_HEARD_ON_KEY, SUCESOS_KEY, VILLAIN_SEEN_KEY,
} from './keys.js';
import { combatEncounter, currentLocationName, partyMembers, worldItemCatalogue } from './state.js';
import { recordFinishedCampaign } from './hub.js';
import { deliverRelics } from './loot.js';
import { ensureWorldData, getLocationBoards, lastCompendium, lastDialogues, lastHubHome, lastPack, lastRumors } from './world.js';
import { getCurrentWorldFactions, shiftFactionStanding } from './factions.js';
import {
    advanceCampaignSlot, campaignDay, getCampaignBonds, getCampaignCalendar, getCurrentSlotLabel, recordCampaignBondEvent,
} from './time.js';
import { noteDeed, worldWrite, refreshWorldMemoryPrompt } from './world-growth.js';
import {
    whoPlays, postCombatNarration, tellMoment, postForModel, showTip, noteRollInWindow, storyWindowsOn,
} from './narration.js';
import { partyPurse, payFromParty, savePartyState } from './roster.js';
import { judgeDecision } from './companions.js';
import { raiseFame } from './town.js';
import { statsLines } from './menus.js';

/**
 * El hilo, con sus escenas y pistas ya concordadas con quien juega (J1.4): el guion escribe
 * «si subes {entero|entera}» y aquí sale la forma buena. Lo guardado no se toca: el editor
 * del hilo sigue viendo las dos formas.
 *
 * @returns {import('../game-engine/campaign/plot.js').Plot|null}
 */
export function getPlot() {
    return resolveGenderDeep(readPlot(chat_metadata?.[PLOT_KEY]), whoPlays());
}

/**
 * Poner el hilo en marcha, si esta campana todavia no lo tiene.
 *
 * El del mundo si lo trae escrito; si no, el de su faccion mas peligrosa. Con `announce`
 * se cuenta la mecha, que es como empieza una campana nueva. Sin el, se pone en silencio:
 * una campana que ya iba por la mitad no puede empezar de repente por la primera escena.
 *
 * @param {{announce?: boolean, heroNote?: string}} [options]
 * @returns {Promise<void>}
 */
export async function ensurePlot({ announce = false, heroNote = '' } = {}) {
    await ensureWorldData();
    if (!chat_metadata || chat_metadata[PLOT_STATE_KEY]) return;
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;

    let written = null;
    try {
        const data = await loadWorldInfo(worldName);
        written = readPlot(data?.metadata?.plot);
    } catch (error) {
        console.warn('[party] no se pudo leer el hilo del mundo', error);
    }
    // Mientras se leia, otra llamada ha podido ponerlo.
    if (chat_metadata[PLOT_STATE_KEY]) return;

    const plot = written ?? plotFromFaction({ factions: getCurrentWorldFactions() });
    if (!plot) return;

    chat_metadata[PLOT_KEY] = plot;
    const step = startPlot(plot, Math.max(1, campaignDay()));
    chat_metadata[PLOT_STATE_KEY] = step.state;
    saveMetadata();
    if (announce) {
        chat_metadata[PLOT_ANNOUNCED_KEY] = true;
        await applyPlotStep(step, heroNote);
        await tellOmens(plot);
    } else if (isShellOpen()) refreshGameShell();

    // Donde ya se esta tambien cuenta: si la partida empieza en la sede de quien hay que
    // ir a ver, no hace falta salir y volver.
    if (currentLocationName) notePlot({ kind: 'arrive', place: currentLocationName });
}

/**
 * Lo que un suceso del juego le hace al hilo.
 *
 * Exportado para las vueltas de prueba: empujan el hilo con el mismo suceso que daría el
 * juego («ganar en la cripta») sin jugar la campaña entera (J4.5).
 *
 * @param {any} event
 */
export function notePlot(event) {
    const plot = getPlot();
    if (!plot || !chat_metadata) return;
    // Con el día de hoy: es lo que mide los plazos (idea 106).
    const actBefore = actOf(plot, chat_metadata[PLOT_STATE_KEY]);
    const step = plotEvent(plot, chat_metadata[PLOT_STATE_KEY], event, campaignDay());
    // Una pista suelta también es un paso (idea 107): sin ella aquí, una tirada que solo
    // sumaba una pista no se guardaba, y la investigación no avanzaba nunca.
    if (step.opened.length === 0 && step.done.length === 0 && step.missed.length === 0 && step.clues.length === 0) return;
    chat_metadata[PLOT_STATE_KEY] = step.state;
    saveMetadata();
    void applyPlotStep(step);
    // J2.2: la primera vez que el hilo se mueve, el Diario importa: ahí queda apuntado.
    showTip('journal');
    // Ideas 115 y 143: si cambia el acto, se resume el anterior; y el villano asoma cuando toca.
    const actAfter = actOf(plot, step.state);
    if (actAfter > actBefore) void closeAct(plot, actBefore, actAfter);
    showVillain(plot);
}

/**
 * Idea 143: al cerrarse un acto, su resumen va a la memoria del mundo y sus mensajes salen
 * del prompt (se siguen viendo, pero ya no se pagan).
 *
 * @param {any} plot
 * @param {number} closed
 * @param {number} opened
 * @returns {Promise<void>}
 */
async function closeAct(plot, closed, opened) {
    if (!chat_metadata) return;
    const state = chat_metadata[PLOT_STATE_KEY];
    const doneIds = new Set(Array.isArray(state?.done) ? state.done.map(String) : []);
    const milestones = (plot?.milestones ?? []).filter((/** @type {any} */ m) => Number(m.act) === closed && doneIds.has(String(m.id))).map((/** @type {any} */ m) => String(m.title));
    // U4 del pegamento: lo que movió la historia en este acto, de la crónica. Antes entraban
    // todos los hechos apuntados, fueran de este acto o de antes. Seis líneas cortas como mucho:
    // el resumen va a la memoria del narrador en cada turno.
    const from = Number((chat_metadata[ACT_STARTS_KEY] ?? {})[closed]) || 0;
    const deeds = chronicleOf(chat)
        .filter(entry => entry.index >= from && !entry.minor && entry.category !== 'partida')
        .map(entry => entry.text.split('\n')[0].slice(0, 140))
        .slice(-6);
    const summary = summarizeAct({ act: closed, milestones, deeds });
    chat_metadata[ACT_SUMMARIES_KEY] = addSummary(chat_metadata[ACT_SUMMARIES_KEY], closed, summary);
    const starts = chat_metadata[ACT_STARTS_KEY] && typeof chat_metadata[ACT_STARTS_KEY] === 'object' ? chat_metadata[ACT_STARTS_KEY] : {};
    const range = hideRange({ from: Number(starts[closed]) || 0, to: chat.length - 1 });
    chat_metadata[ACT_STARTS_KEY] = { ...starts, [opened]: chat.length };
    saveMetadata();
    // Z1: si cuenta el motor, el cierre en su prosa; si no, el resumen. Una vez, no las dos.
    const closing = tellMoment('acto', { acto: closed, hitos: listNames(milestones) });
    postCombatNarration(closing ? `📜 [HILO] ${closing}` : `📜 [HILO] Se cierra el acto ${closed}. ${summary}`);
    if (range) {
        try {
            const { hideChatMessageRange } = await import('../chats.js');
            await hideChatMessageRange(range.start, range.end, false);
        } catch (error) {
            console.warn('[party] no se pudieron ocultar los mensajes del acto', error);
        }
    }
    refreshWorldMemoryPrompt();
}

/**
 * Idea 115: las escenas del villano que tocan ya, una vez cada una.
 *
 * @param {any} plot
 */
function showVillain(plot) {
    if (!chat_metadata) return;
    const villain = readVillain(plot?.villain);
    if (!villain) return;
    const seen = Array.isArray(chat_metadata[VILLAIN_SEEN_KEY]) ? chat_metadata[VILLAIN_SEEN_KEY].map(String) : [];
    const state = chat_metadata[PLOT_STATE_KEY];
    const due = villainScenesDue({ villain, act: actOf(plot, state), done: Array.isArray(state?.done) ? state.done : [], seen });
    if (due.length === 0) return;
    for (const scene of due) {
        seen.push(scene.id);
        noteDeed(`${villain.name} se dejó ver.`);
        postCombatNarration(`🦹 [HILO] ${villain.name}: ${scene.scene}`);
        void postForModel(villainNote(villain, scene.scene));
    }
    chat_metadata[VILLAIN_SEEN_KEY] = seen;
    saveMetadata();
}

/**
 * Aplicar un paso del hilo: revelar sitios, mover reputaciones y contarlo.
 *
 * Lo que se cuenta va al narrador por el canal que lee, con la escena escrita y la orden
 * de no inventar: la trama es del mundo, no del modelo.
 *
 * @param {import('../game-engine/campaign/plot.js').PlotStep} step
 * @returns {Promise<void>}
 */
async function applyPlotStep(step, heroNote = '') {
    if (step.changes.reveal.length > 0) await revealLocations(step.changes.reveal);
    for (const [faction, amount] of Object.entries(step.changes.standing)) {
        void shiftFactionStanding(faction, amount);
    }

    // J9.2 y D-J40: lo que se abre (y los secretos que se encuentran) se juega en la ventana de
    // escena, también lo que solo trae texto. Su texto ya no va en la nota: al acabar la escena,
    // el narrador lee lo que pasó en ella.
    const scenes = storyWindowsOn() ? stepScenes(step, sceneInput()) : [];
    const inWindow = new Set(scenes.map(entry => String(entry.milestone?.id)));
    queuePlotScenes(scenes);

    /** @type {string[]} */
    const lines = [];
    // Idea 101: cómo se cumplió, cuando había varias formas.
    const WAYS = { win: 'luchando', talk: 'hablando', check: 'con maña', arrive: 'llegando', defeat: 'derrotándole', contract: 'con un encargo' };
    // Idea 107: las pistas que se acaban de encontrar.
    for (const found of step.clues) {
        noteDeed(`Una pista para «${found.milestone.title}» (${found.found} de ${found.need}).`);
        lines.push(`Una pista más para «${found.milestone.title}»: ${found.found} de ${found.need}.`);
        toastr.info(`${found.found} de ${found.need}`, `🔍 Una pista: ${found.milestone.title}`, { timeOut: 8000 });
    }
    for (const milestone of step.done) {
        const via = step.via?.[milestone.id];
        noteDeed(`Cumplido${via ? ` (${WAYS[/** @type {keyof typeof WAYS} */ (via)] ?? via})` : ''}: ${milestone.title}.`);
        // Idea 28: cómo se resolvió, cuando había más de una forma, también se juzga.
        if (via) judgeDecision(via === 'win' || via === 'defeat' ? 'hito-luchando' : via === 'talk' ? 'hito-hablando' : via === 'check' ? 'hito-maña' : '');
        if (milestone.hidden) {
            // Idea 111: un secreto de la historia. Su escena se cuenta ahora, al encontrarlo.
            lines.push(`Un secreto de la historia: ${milestone.title}.`);
            if (milestone.scene && !inWindow.has(String(milestone.id))) lines.push(milestone.scene);
            toastr.success(milestone.title, '🏅 Un secreto de la historia', { timeOut: 12000 });
        } else if (milestone.asks.kind !== 'none') {
            // Los que se cumplen solos son escenas: se cuentan al abrirse, no dos veces.
            lines.push(`Hecho: ${milestone.title}.`);
            // Idea 52: lo que se hace en un sitio, allí se sabe.
            raiseFame(currentLocationName);
        }
        // Idea 132: la reliquia de este hito, si la tiene.
        lines.push(...deliverRelics({ kind: 'milestone', id: milestone.id }));
    }
    for (const milestone of step.opened) {
        // Lo oculto no se cuenta al abrirse: sería decirlo.
        if (milestone.scene && !milestone.hidden && !inWindow.has(String(milestone.id))) lines.push(milestone.scene);
    }
    // Idea 102: los caminos que se cierran por lo que se ha elegido.
    for (const milestone of step.closed ?? []) {
        noteDeed(`Se cierra un camino: ${milestone.title}.`);
        lines.push(`Por lo que habéis elegido, se cierra un camino: ${milestone.title}.`);
        toastr.warning(milestone.title, '🚧 Se cierra un camino', { timeOut: 10000 });
    }
    // Idea 106: lo que tenía plazo y se ha pasado.
    for (const milestone of step.missed) {
        noteDeed(`Se os pasó el plazo: ${milestone.title}.`);
        lines.push(`Se ha pasado el plazo y ya no hay remedio: ${milestone.title}.`);
        toastr.warning(milestone.title, '⌛ Se os pasó el plazo', { timeOut: 12000 });
    }
    // Idea 114: el presagio que se cumple.
    for (const omen of step.omens) {
        lines.push(`Se cumple el presagio del principio: «${omen}».`);
        toastr.info(`«${omen}»`, '🔮 Se cumple el presagio', { timeOut: 12000 });
    }
    if (step.changes.reveal.length > 0) lines.push(`Ahora se sabe cómo llegar a: ${step.changes.reveal.join(', ')}.`);
    if (heroNote && lines.length > 0) lines.push(heroLine(heroNote));

    // Un final: cual, lo decide con quien os habeis aliado. Se cuenta entero y se guarda.
    const endingId = chooseEnding(step.changes, getCurrentWorldFactions());
    if (endingId && chat_metadata) {
        const ending = getPlot()?.endings?.[endingId];
        chat_metadata.plotEnding = endingId;
        saveMetadata();
        if (ending?.scene) lines.push(ending.scene);
        noteDeed(`Final: ${ending?.title || endingId}.`);
        toastr.success(ending?.title || endingId, 'Final', { timeOut: 15000 });
        // J3.9: la campaña terminada entra en el salón de la fama.
        recordFinishedCampaign();
        // J4.5: la escena del final, con qué fue de cada uno y lo que se lleva.
        const summary = endingSummary();
        if (summary?.people.length) lines.push(`Qué fue de la gente: ${summary.people.join(' ')}`);
        if (summary?.companions.length) lines.push(`Qué fue de cada uno: ${summary.companions.join(' ')}`);
        if (summary) void showEnding(summary);
    }

    const focus = focusOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY], campaignDay());
    // Corto: la linea fija de arriba ya lo dice, esto es solo el aviso del cambio.
    if (focus && step.done.length > 0) toastr.info(describeFocus(focus), 'Lo que tienes entre manos', { timeOut: 5000 });
    if (isShellOpen()) refreshGameShell();

    if (lines.length === 0) return;
    lines.push('Cuéntalo en uno o dos párrafos, en el tono de la campaña. No inventes nada que no esté aquí.');
    await postForModel(`[HILO] ${lines.join('\n')}`)
        .catch(error => console.error('[party] plot note failed', error));
}

/** @param {any} value @returns {string} */
const fold = (value) => String(value ?? '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Quien juega: el héroe (no un invitado), que es quien decide en las escenas y tira en ellas.
 *
 * @returns {any}
 */
export function storyHero() {
    return partyMembers.find(m => !m.guest && !m.dead) ?? partyMembers.find(m => !m.dead) ?? partyMembers[0] ?? null;
}

/**
 * Lo que una escena necesita para leerse: las charlas del paquete, las ya jugadas y quién juega.
 *
 * @returns {{dialogues: any[], played: string[], hero: any, party: any[]}}
 */
function sceneInput() {
    return {
        dialogues: lastDialogues,
        played: Array.isArray(chat_metadata?.[PLOT_SCENES_PLAYED_KEY]) ? chat_metadata[PLOT_SCENES_PLAYED_KEY].map(String) : [],
        hero: storyHero(),
        party: partyMembers.filter(m => !m.dead),
    };
}

/**
 * Cómo está la partida para las condiciones de una escena o una charla (J8): cómo os mira
 * `who`, los hitos, lo que lleváis, el oro, el grupo y el día.
 *
 * @param {string} [who]
 * @param {number} [attitude] Si ya se sabe (quien os planta cara no os mira neutral).
 * @returns {import('../game-engine/campaign/dialogues.js').DialogueWorld}
 */
export function storyWorld(who = '', attitude = undefined) {
    const state = readPlotState(chat_metadata?.[PLOT_STATE_KEY]);
    return {
        ...(who ? { attitude: attitude ?? attitudeBonus(chat_metadata?.[ATTITUDES_KEY], who) } : {}),
        open: state.open,
        done: state.done,
        items: partyMembers.flatMap(m => (Array.isArray(m.items) ? m.items : []).map((/** @type {any} */ i) => String(i?.name ?? ''))).filter(Boolean),
        gold: partyPurse(),
        party: partyMembers.filter(m => !m.dead),
        day: Math.max(1, campaignDay()),
        // J11.1: los hitos que pesan, para avisar en la opción que los cumple.
        weighty: weightyMilestones(getPlot()),
    };
}

/**
 * J11.1: antes de entrar en un tablero cuya victoria no tiene vuelta atrás (el que acaba la
 * campaña, o uno que cierra otros caminos), se pregunta, sin decir qué se pierde. Sin aviso, sí.
 *
 * @param {string} boardName
 * @returns {Promise<boolean>} Si se entra.
 */
export async function confirmBoardNoReturn(boardName) {
    const plot = getPlot();
    if (!plot || !chat_metadata || !String(boardName ?? '').trim()) return true;
    const warning = actionNoReturn({
        plot, state: chat_metadata[PLOT_STATE_KEY], event: { kind: 'win', place: currentLocationName, board: String(boardName) }, today: Math.max(1, campaignDay()),
    });
    if (!warning) return true;
    const ask = noReturnConfirm({ warning, what: `Entrar en ${boardName}` });
    const body = $('<div class="nr-confirm gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(ask.title));
    body.append($('<p></p>').text(ask.text));
    const answer = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: ask.ok, cancelButton: ask.cancel }).show();
    return Boolean(answer);
}

/**
 * J7.5: cómo es cada compañero (lo que busca, lo que le gusta y lo que no), del compendio.
 *
 * @returns {import('../game-engine/campaign/companion-cards.js').CompanionCard[]}
 */
function companionCards() {
    return lastCompendium?.has?.('companeros') ? readCompanionCards(lastCompendium.find('companeros', {})) : [];
}

/**
 * @typedef {{scene?: boolean, dialogue?: any}} OpinionContext D-J48: de dónde es la opción: de
 *   una escena del hilo (`scene`) o de una charla escrita (`dialogue`, para ver adónde lleva).
 */

/**
 * J7.5: lo que opina cada compañero del grupo de una opción escrita (de una charla o de una
 * escena del hilo). Quien juega no opina de sí mismo. D-J48: solo de las importantes
 * (`importantOption`): en lo demás, nadie opina.
 *
 * @param {any} option
 * @param {OpinionContext} [context]
 * @returns {import('../game-engine/campaign/companion-opinions.js').Opinion[]}
 */
export function optionOpinions(option, context = {}) {
    if (!importantOption(option, context)) return [];
    const hero = storyHero();
    const party = [hero, ...partyMembers.filter(m => m !== hero)].filter(Boolean);
    return opinionsOn({ option, party, cards: companionCards() });
}

/**
 * J7.5: lo que se ve en la opción antes de elegirla: «A Gerd le gusta esto».
 *
 * @param {any} option
 * @param {OpinionContext} [context]
 * @returns {import('../game-engine/campaign/companion-opinions.js').OpinionBadge[]}
 */
export function optionOpinionTags(option, context = {}) {
    return opinionBadges(optionOpinions(option, context));
}

/**
 * J7.5: al elegirla, lo que opinan cuenta para el vínculo (`judgeDecision`, sin aviso: la
 * ventana lo dice) y se devuelve dicho para la ventana: «A Gerd le ha gustado.».
 *
 * @param {any} option
 * @param {OpinionContext} [context]
 * @returns {string[]}
 */
export function judgeOption(option, context = {}) {
    const opinions = optionOpinions(option, context);
    if (opinions.length === 0) return [];
    judgeDecision('', { verdicts: verdictsOf(opinions), quiet: true });
    return opinionNotes(opinions);
}

/** @returns {boolean} Si es de noche, para el escenario de noche. */
export function storyNight() {
    return /noche/i.test(String(getCurrentSlotLabel() || ''));
}

/**
 * J9.2 y J8: lo que cambia una decisión de una escena o de una charla, aplicado a la partida:
 * cómo os mira la gente, los rumores (y el sitio al que llevan), el oro, lo que se da y se
 * quita, los vínculos, el rato que se va y los hitos. Devuelve cómo decirlo en la ventana.
 *
 * @param {import('../game-engine/campaign/dialogues.js').DialogueEffect[]} effects
 * @param {Object} [options]
 * @param {any} [options.roll] La tirada de ese paso, para el registro de dados.
 * @param {any} [options.hero] Quien decide (recibe lo que se da y el oro).
 * @param {string[]|null} [options.defer] Dónde dejar los hitos para cumplirlos después (al
 *   cerrarse la escena); sin él, se cumplen ya.
 * @param {string[]|null} [options.clues] Dónde dejar lo que se apunta (las pistas).
 * @returns {Promise<string[]>}
 */
export async function applySceneEffectsToGame(effects, { roll = null, hero = null, defer = null, clues = null } = {}) {
    if (!chat_metadata) return [];
    const who = hero ?? storyHero();
    if (roll && who) noteRollInWindow(who, roll);
    const list = Array.isArray(effects) ? effects : [];
    if (list.length === 0) return [];
    const out = applySceneEffects(list, {
        attitudes: chat_metadata[ATTITUDES_KEY],
        rumorsHeard: chat_metadata[RUMORS_HEARD_KEY],
        rumorsHeardOn: chat_metadata[RUMORS_HEARD_ON_KEY],
        rumors: lastRumors,
        day: Math.max(1, campaignDay()),
        gold: partyPurse(),
        items: storyWorld().items,
        who: whoPlays(),
    });
    chat_metadata[ATTITUDES_KEY] = out.attitudes;
    chat_metadata[RUMORS_HEARD_KEY] = out.rumorsHeard;
    chat_metadata[RUMORS_HEARD_ON_KEY] = out.rumorsHeardOn;
    const holder = who ?? partyMembers[0];
    if (out.goldChange > 0 && holder) holder.gold = (Number(holder.gold) || 0) + out.goldChange;
    else if (out.goldChange < 0) payFromParty(Math.min(partyPurse(), -out.goldChange));
    for (const name of out.give) {
        if (holder) addItemToInventory(/** @type {any} */ (holder), createItem(/** @type {any} */ (describeLootItem(name, '', worldItemCatalogue))));
    }
    for (const name of out.take) {
        const owner = partyMembers.find(m => (m.items ?? []).some((/** @type {any} */ i) => fold(i?.name) === fold(name)));
        const item = owner?.items?.find((/** @type {any} */ i) => fold(i?.name) === fold(name));
        if (owner && item) removeItemFromInventory(/** @type {any} */ (owner), String(item.id));
    }
    for (const bond of out.bonds) {
        const member = partyMembers.find(m => fold(m.name) === fold(bond.who));
        if (member) recordCampaignBondEvent(String(member.id), bond.amount > 0 ? 'confidant_scene' : 'disapproved');
    }
    for (let i = 0; i < out.time; i++) advanceCampaignSlot();
    if (out.reveal.length > 0) await revealLocations(out.reveal);
    if (Array.isArray(clues)) clues.push(...out.clues);
    saveMetadata();
    savePartyState();
    if (Object.keys(out.attitudes.changed).length > 0) refreshWorldMemoryPrompt();
    for (const id of out.milestones) {
        if (Array.isArray(defer)) defer.push(id);
        else notePlot({ kind: 'milestone', id });
    }
    if (isShellOpen()) refreshGameShell();
    return out.notes;
}

/**
 * D-J40: lo que solo trae texto, como una escena corta del narrador: un párrafo por pantalla.
 *
 * @param {import('../game-engine/campaign/plot-scenes.js').PlotScene} scene
 * @returns {import('../game-engine/campaign/plot-scenes.js').PlotScene}
 */
export function narratorScene(scene) {
    if (scene.kind === 'scene') return scene;
    const parts = String(scene.text || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
    return { ...scene, kind: 'scene', beats: parts.map(text => ({ who: '', mood: 'neutral', text, decision: null })), dialogue: null };
}

/**
 * D-J39: si la escena de un hito de «habla con X» ya es esa charla (como la de Karl, o la de
 * Tomás en el muelle): habla X en ella y ninguna charla escrita cumple el hito por su cuenta.
 * Con una charla que lo cumple (Giles, Brunilda), lo cumple ella, cuando se cuenta lo que importa.
 *
 * @param {any} milestone
 * @param {import('../game-engine/campaign/plot-scenes.js').PlotScene} scene
 * @returns {boolean}
 */
export function sceneIsTheTalk(milestone, scene) {
    if (milestone?.asks?.kind !== 'talk') return false;
    const npc = fold(milestone.asks.npc);
    if (!npc) return false;
    const speaks = (scene?.beats ?? []).some(beat => fold(beat.who) === npc) || fold(scene?.dialogue?.speaker) === npc;
    if (!speaks) return false;
    return !lastDialogues.some(dialogue => dialogueMilestones(dialogue).includes(String(milestone.id)));
}

/** Las escenas, de una en una: dos hitos que se abren a la vez no se tapan. */
let sceneQueue = Promise.resolve();

/** Cuántas escenas esperan o se están jugando ahora (para quien necesite saberlo, como las pruebas). */
export let scenesPending = 0;

/**
 * Esperar a que se pueda abrir una escena: sin pelea, sin el panel de victoria delante (se abre
 * cuando se cierra) y sin otra ventana de historia abierta.
 *
 * @param {any} owner Los metadatos de la partida que la pidió: si se cambia de partida, no se abre.
 * @returns {Promise<boolean>} Si se puede abrir.
 */
async function sceneStage(owner) {
    await new Promise(resolve => setTimeout(resolve, 0));
    for (;;) {
        if (chat_metadata !== owner) return false;
        const busy = combatEncounter.active || document.querySelector('.vs-card') || document.querySelector('dialog.qd-dialog[open]');
        if (!busy) return true;
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

/**
 * J9.2: poner en cola las escenas de un paso del hilo. No espera a que se jueguen: quien lo
 * llama (crear la partida, ganar una pelea) sigue, y la escena sale en cuanto se puede.
 *
 * @param {Array<{milestone: any, scene: import('../game-engine/campaign/plot-scenes.js').PlotScene}>} entries
 * @returns {Promise<void>}
 */
function queuePlotScenes(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return sceneQueue;
    const owner = chat_metadata;
    scenesPending += entries.length;
    sceneQueue = sceneQueue.then(async () => {
        for (const entry of entries) {
            try {
                if (await sceneStage(owner)) await playPlotScene(entry.milestone, entry.scene);
            } catch (error) {
                console.error('[party] la escena del hilo falló', error);
            } finally {
                scenesPending = Math.max(0, scenesPending - 1);
                // D-J45: acabada la escena, «Continuar» ya no lleva a ella: la fila se redibuja.
                if (isShellOpen()) refreshGameShell();
            }
        }
    });
    return sceneQueue;
}

/**
 * Jugar la escena de un hito en su ventana y dejar lo que pasó: la escena, apuntada como
 * jugada; lo decidido, en el Diario; lo que pasó, en el registro para el narrador («no la
 * repitas»); y los hitos que cumplió (los suyos y, con D-J39, el propio).
 *
 * @param {any} milestone
 * @param {import('../game-engine/campaign/plot-scenes.js').PlotScene} scene
 * @returns {Promise<void>}
 */
async function playPlotScene(milestone, scene) {
    const shown = narratorScene(scene);
    if (shown.beats.length === 0 && !shown.dialogue) return;
    const hero = storyHero();
    /** @type {string[]} */
    const pending = [];
    /** @type {string[]} */
    const clues = [];
    /** J9.6: lo que salió de cada decisión, por su línea, para el libro. @type {Record<number, string[]>} */
    const came = {};
    const cameOf = (/** @type {number} */ beat, /** @type {string[]} */ lines) => {
        if (lines.length > 0) came[beat] = [...(came[beat] ?? []), ...lines];
        return lines;
    };
    const result = await openPlotScene({
        scene: shown,
        hero,
        getWorld: (who) => storyWorld(who),
        rollD20: () => rollDiceDetailed('1d20', 20).total,
        applyEffects: async (effects, context) => cameOf(context.beat, await applySceneEffectsToGame(effects, { roll: context.roll, hero, defer: pending, clues })),
        // J7.5: lo que opina el grupo de cada opción, y al elegir, su aprobación. D-J48: una escena
        // del hilo es de las charlas importantes, toda ella.
        opinionsFor: (option) => optionOpinionTags(option, { scene: true }),
        onChoice: (optionId, context) => {
            // J11.2: la charla del final de la escena también deja lo que vuelve días después.
            if (context.beat < 0 && shown.dialogue) recordDialogueAftermath(shown.dialogue, optionId, context.outcome);
            return cameOf(context.beat, judgeOption(context.option, { scene: true }));
        },
        memory: chat_metadata?.[DIALOGUE_MEMORY_KEY] ?? null,
        onMemory: (memory) => {
            if (!chat_metadata) return;
            chat_metadata[DIALOGUE_MEMORY_KEY] = memory;
            saveMetadata();
        },
        pack: lastPack,
        town: currentLocationName,
        night: storyNight(),
    });
    if (!chat_metadata) return;
    chat_metadata[PLOT_SCENES_PLAYED_KEY] = rememberScene(chat_metadata[PLOT_SCENES_PLAYED_KEY], String(shown.id));
    // J9.6: lo que se decidió (con su hito, su capítulo y lo que salió de ello: el libro lo lee
    // así), con lo que la opción deja apuntado, y las pistas de la escena.
    const noted = (result.choices ?? []).map(choice => String(shown.beats[choice.beat]?.decision?.dialogue?.nodes?.[0]?.options
        ?.find(option => option.id === choice.option)?.journal ?? '').trim()).filter(Boolean);
    const entries = sceneDecisionEntries({
        scene: shown, choices: result.choices ?? [], came, milestone, day: Math.max(1, campaignDay()), notes: [...noted, ...clues],
    });
    if (entries.length > 0) chat_metadata[PLOT_DECISIONS_KEY] = recordDecisions(chat_metadata[PLOT_DECISIONS_KEY], entries);
    // J11.2: consecuencias diferidas de lo que se decidió en la escena (aftermath.js). Sin sitio:
    // vuelven donde estéis ese día, como dice el motor, y no solo si se vuelve aquí.
    const follows = sceneFollows(milestone, result.choices);
    if (follows.length > 0) {
        const day = Math.max(1, campaignDay());
        const sucesoState = readSucesoState(chat_metadata[SUCESOS_KEY]);
        chat_metadata[SUCESOS_KEY] = scheduleFollows(sucesoState, { follows, day });
    }
    saveMetadata();
    // Lo que pasó, línea a línea, y la charla del final si la hubo.
    const talk = (result.dialogue?.state?.log ?? [])
        .filter((/** @type {any} */ line) => line.kind === 'npc' || line.kind === 'hero')
        .map((/** @type {any} */ line) => (line.kind === 'npc' ? `${line.who}: «${line.text}»` : `Tú: «${line.text}»`));
    const transcript = [...(result.transcript ?? sceneTranscript(shown, result.choices)), ...talk];
    if (transcript.length > 0) {
        await postForModel(`[HILO] Esta escena ya se ha jugado en pantalla («${shown.title}»):\n${transcript.join('\n')}\nNo digas otra vez lo que ya se ha jugado: la escena no se repite, se sigue desde aquí.`,
            { show: `📜 [HILO] ${transcript.join('\n')}` })
            .catch(error => console.error('[party] scene note failed', error));
    }
    // D-J39: la escena que ya es la charla del hito lo cumple; y los hitos que cumplió lo que se eligió.
    if (sceneIsTheTalk(milestone, shown) && !pending.includes(String(milestone.id))) pending.push(String(milestone.id));
    for (const id of pending) notePlot({ kind: 'milestone', id });
    if (isShellOpen()) refreshGameShell();
}

/**
 * J4.5: lo que cuenta el final de la campaña abierta. Null si no ha llegado a ninguno.
 *
 * @returns {{title: string, scene: string, people: string[], companions: string[], take: string[], numbers: string[]}|null}
 */
function endingSummary() {
    const endingId = String(chat_metadata?.plotEnding || '');
    if (!endingId) return null;
    const ending = getPlot()?.endings?.[endingId];
    const title = String(ending?.title || endingId);
    // Idea 109: qué fue de cada compañero.
    const bondsNow = getCampaignBonds();
    const companions = companionEpilogues({
        party: partyMembers,
        ranks: Object.fromEntries(partyMembers.map(m => [String(m.id), getBondProgress(bondsNow, String(m.id)).rank])),
        ending: title,
        graves: readGraves(chat_metadata?.[GRAVES_KEY]),
        // J4.5: si la campaña sale de un gremio, quien sigue vivo vuelve con vosotros.
        home: Boolean(lastHubHome),
    });
    // Idea 111: los secretos encontrados, y cuántos había.
    const secrets = secretsOf(getPlot(), chat_metadata?.[PLOT_STATE_KEY]);
    return {
        title,
        scene: String(ending?.scene || ''),
        people: endingEpilogues({ ending, factions: getCurrentWorldFactions() }),
        companions,
        take: takeHome({ party: partyMembers, start: readPartyStart(chat_metadata?.[CAMPAIGN_START_KEY]) }).map(t => t.line),
        // Idea 200: la partida en números, al cerrar.
        numbers: [...statsLines(), ...(secrets.total > 0 ? [`Secretos de la historia: ${secrets.found.length} de ${secrets.total}`] : [])],
    };
}

/**
 * J4.5: la escena del final. El título, lo que pasó, qué fue de la gente y de cada
 * compañero, lo que se lleva cada uno y los números; y, si la campaña sale de un gremio, el
 * botón para volver a él.
 *
 * @param {NonNullable<ReturnType<typeof endingSummary>>} summary
 * @returns {Promise<void>}
 */
async function showEnding(summary) {
    const card = $('<div class="st-root end-root gs-panel"></div>');
    card.append($('<h3 class="gs-popup-title"></h3>').text(`Final: ${summary.title}`));
    if (summary.scene) card.append($('<p class="end-scene"></p>').text(summary.scene));
    /** @param {string} title @param {string[]} rows @param {string} kind */
    const section = (title, rows, kind) => {
        if (rows.length === 0) return;
        card.append($('<h4 class="end-head"></h4>').text(title));
        for (const row of rows) card.append($(`<div class="jr-item ${kind}"></div>`).text(row));
    };
    section('Lo que dejáis atrás', summary.people, 'end-epilogue');
    section('Qué fue de cada uno', summary.companions, 'ep-line');
    section('Lo que se lleva cada uno', summary.take, 'end-take');
    section('La partida en números', summary.numbers, 'end-number');
    const home = Boolean(lastHubHome);
    const HOME = 71;
    const choice = await new Popup(card[0], POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        leftAlign: true,
        allowVerticalScrolling: true,
        customButtons: home ? [{ text: 'Volver al gremio', result: HOME, classes: ['end-home'], icon: 'fa-house-flag' }] : [],
    }).show();
    if (choice !== HOME) return;
    if (combatEncounter.active) {
        toastr.warning('No mientras peleáis.');
        return;
    }
    const { returnToHub } = await import('../campaigns.js');
    await returnToHub();
}

/**
 * J4.5: volver a ver el final de la campaña abierta.
 *
 * @returns {Promise<string>}
 */
export async function openEnding() {
    const summary = endingSummary();
    if (!summary) {
        toastr.info('Esta campaña todavía no ha llegado a su final.', 'El final');
        return '';
    }
    await showEnding(summary);
    return '';
}

/**
 * Quien juega, para la mecha: su pasado manda sobre como se cuenta la primera escena.
 *
 * @param {string} heroNote
 * @returns {string}
 */
function heroLine(heroNote) {
    return `Quien juega es ${heroNote}. Adapta la escena a quién es: no contradigas su pasado.`;
}

/**
 * Pasar al mapa los sitios que el hilo acaba de revelar.
 *
 * Las escondidas viven en `hiddenLocations`, fuera de la lista que usa todo lo demas: asi
 * nada tiene que saber que existen hasta que existen.
 *
 * @param {string[]} names
 * @returns {Promise<void>}
 */
export function revealLocations(names) {
    return worldWrite(() => revealLocationsNow(names));
}

/**
 * @param {string[]} names
 * @returns {Promise<void>}
 */
async function revealLocationsNow(names) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data?.metadata) return;
        const wanted = new Set(names.map(n => String(n).toLowerCase()));
        const hidden = Array.isArray(data.metadata.hiddenLocations) ? data.metadata.hiddenLocations : [];
        const found = hidden.filter((/** @type {any} */ l) => wanted.has(String(l?.name).toLowerCase()));
        if (found.length === 0) return;
        data.metadata.hiddenLocations = hidden.filter((/** @type {any} */ l) => !found.includes(l));
        data.metadata.locationMaps = [...(data.metadata.locationMaps ?? []), ...found];
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
    } catch (error) {
        console.error('[party] no se pudo revelar el sitio', error);
    }
}

/** @returns {any[]} Los hitos abiertos del hilo que se ven: los ocultos no (idea 111). */
export function openMilestones() {
    const plot = getPlot();
    if (!plot || !chat_metadata) return [];
    return visibleOpen(plot, chat_metadata[PLOT_STATE_KEY]);
}

/** Dar las pistas que tocan hoy (idea 103). */
export function giveDueHints() {
    if (!chat_metadata) return;
    const open = openMilestones();
    if (open.length === 0) return;
    const saved = chat_metadata[HINTS_KEY] ?? {};
    const due = dueHints({
        open,
        openedDay: saved.openedDay,
        given: saved.given,
        // Idea 41: con un erudito en el grupo, las pistas llegan un dia antes.
        today: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)) + (withJob(partyMembers, 'erudito') ? 1 : 0),
        skillLabel: (skill) => SKILLS[/** @type {keyof typeof SKILLS} */ (skill)]?.label ?? skill,
    });
    /** @type {Record<string, string[]>} */
    const clues = { ...(saved.clues ?? {}) };
    for (const hint of due.hints) clues[hint.id] = [...(clues[hint.id] ?? []), hint.text];
    chat_metadata[HINTS_KEY] = { openedDay: due.openedDay, given: due.given, clues };
    saveMetadata();
    for (const hint of due.hints) {
        toastr.info(hint.text, 'Una pista', { timeOut: 10000 });
        void postForModel('[PISTA] El grupo lleva días sin avanzar. Que les llegue esto por boca de alguien del lugar, '
            + `con naturalidad y sin nombrar reglas: ${hint.text}`);
    }
}

/**
 * Empezar el hilo de una campana recien creada, contando la mecha.
 *
 * @returns {Promise<void>}
 */
export async function beginCampaignPlot(heroNote = '') {
    // J4.5: cómo empieza el grupo, para contar al final lo que se lleva cada uno.
    if (chat_metadata && !chat_metadata[CAMPAIGN_START_KEY]) {
        chat_metadata[CAMPAIGN_START_KEY] = partyAtStart(partyMembers, Math.max(1, campaignDay()));
        saveMetadata();
    }
    await ensurePlot({ announce: true, heroNote });
    // Idea 184: los hitos que no son para este héroe se cierran, en silencio.
    fitPlotToHero();
    // Al crear la campana, el arranque silencioso (el de las campanas viejas, al cambiar de
    // chat) puede haber ganado la carrera: entonces el hilo ya esta en marcha y la mecha no
    // se ha contado. Se cuenta ahora, una sola vez.
    const plot = getPlot();
    if (plot && chat_metadata && !chat_metadata[PLOT_ANNOUNCED_KEY]) {
        chat_metadata[PLOT_ANNOUNCED_KEY] = true;
        saveMetadata();
        const opening = startPlot(plot, Math.max(1, campaignDay()));
        // J9.2: la apertura también se juega en su ventana; lo que no, se cuenta como antes.
        const scenes = storyWindowsOn() ? stepScenes(opening, sceneInput()) : [];
        const inWindow = new Set(scenes.map(entry => String(entry.milestone?.id)));
        queuePlotScenes(scenes);
        const lines = opening.opened.filter(m => !m.hidden && !inWindow.has(String(m.id))).map(m => m.scene).filter(Boolean);
        if (lines.length > 0 && heroNote) lines.push(heroLine(heroNote));
        if (lines.length > 0) {
            lines.push('Cuéntalo en uno o dos párrafos, en el tono de la campaña. No inventes nada que no esté aquí.');
            await postForModel(`[HILO] ${lines.join('\n')}`)
                .catch(error => console.error('[party] opening note failed', error));
        }
        await tellOmens(plot);
    }
}

/**
 * Idea 184: cerrar los hitos que el guion escribió para otros trasfondos. Una vez.
 */
function fitPlotToHero() {
    const plot = getPlot();
    if (!plot || !chat_metadata || chat_metadata[HERO_FIT_KEY] || !partyMembers[0]) return;
    const skip = notForHero(plot, partyMembers[0]);
    chat_metadata[HERO_FIT_KEY] = true;
    if (skip.length > 0) {
        const state = readPlotState(chat_metadata[PLOT_STATE_KEY]);
        chat_metadata[PLOT_STATE_KEY] = { ...state, open: state.open.filter(id => !skip.includes(id)), closed: [...new Set([...state.closed, ...skip])] };
    }
    saveMetadata();
}

/**
 * Idea 114: el presagio, al empezar. Al narrador, para que lo diga tal cual; y en el chat,
 * para quien juega. Una vez.
 *
 * @param {import('../game-engine/campaign/plot.js').Plot} plot
 * @returns {Promise<void>}
 */
async function tellOmens(plot) {
    if (!chat_metadata || chat_metadata.omensTold || (plot.omens ?? []).length === 0) return;
    chat_metadata.omensTold = true;
    saveMetadata();
    const said = plot.omens.map(o => `«${o.text}»`).join(' ');
    // Un solo mensaje: el narrador lee la nota, y quien juega lo ve una vez (antes salía
    // dos: la línea del hilo y la nota, que sin modelo también se veía).
    await postForModel(`[PRESAGIO] Alguien lo murmura, o se sueña. Dilo tal cual, sin explicarlo: ${said}`, { show: `🔮 [HILO] El presagio: ${said}` })
        .catch(error => console.error('[party] omens note failed', error));
}

/**
 * J4: el final al que ha llegado la campaña abierta, si ha llegado a alguno.
 *
 * @returns {string}
 */
export function plotEndingTitle() {
    const id = String(chat_metadata?.plotEnding || '');
    return id ? String(getPlot()?.endings?.[id]?.title || id) : '';
}

/**
 * J9.6: el libro de la campaña abierta: sus capítulos (J9.3), los plazos (J9.5), lo decidido y
 * lo que salió de ello (J11.5), de lo que la partida guarda.
 *
 * @returns {import('../game-engine/campaign/story-book.js').StoryBook}
 */
export function campaignBook() {
    /** @type {Record<string, string>} */
    const boardPlaces = {};
    for (const place of getCurrentWorldLocationMaps()) {
        for (const board of getLocationBoards(place)) {
            const name = String(board?.name ?? '').trim().toLowerCase();
            if (name && !boardPlaces[name]) boardPlaces[name] = String(place?.name ?? '');
        }
    }
    return buildStoryBook(bookInputFromMetadata(chat_metadata, {
        chat: Array.isArray(chat) ? chat : [],
        today: Math.max(1, campaignDay()),
        who: whoPlays(),
        factions: getCurrentWorldFactions(),
        boardPlaces,
        title: String(chat_metadata?.[HUB_BOARD_NAME_KEY] ?? ''),
    }));
}

/**
 * J9.3 y J11.5: lo que el gremio se lleva de la campaña al volver: por qué capítulo ibais (para
 * su tarjeta del tablón) y el libro, para leer su crónica desde allí.
 *
 * @returns {{chapter: string, book: import('../game-engine/campaign/story-book.js').StoryBook|null}}
 */
export function campaignChronicle() {
    try {
        return { chapter: guildChapterLine(chat_metadata?.[PLOT_KEY], chat_metadata?.[PLOT_STATE_KEY]), book: campaignBook() };
    } catch (error) {
        console.error('[party] no se pudo montar la crónica de la campaña', error);
        return { chapter: '', book: null };
    }
}

/**
 * J9.5: el reloj de lo que tenéis entre manos, para la cabecera: el del hito de la pantalla si
 * tiene plazo; si no, el más apurado. Nada sin plazos.
 *
 * @returns {import('../game-engine/campaign/story-book.js').BookClock|null}
 */
export function focusDeadline() {
    const plot = getPlot();
    if (!plot || !chat_metadata) return null;
    const focus = focusOf(plot, chat_metadata[PLOT_STATE_KEY], campaignDay());
    return focusClock(plot, chat_metadata[PLOT_STATE_KEY], Math.max(1, campaignDay()), String(/** @type {any} */ (focus)?.id ?? ''));
}

/**
 * Consecuencias diferidas que vuelven de una decisión en una charla escrita (J11.2).
 *
 * @param {any} dialogue
 * @param {string} optionId
 * @param {'bien'|'medias'|'mal'|null} [outcome]
 */
export function recordDialogueAftermath(dialogue, optionId, outcome = null) {
    if (!chat_metadata) return;
    // `later` va en la charla como se escribió: la leída (`dialogueFor`) ya no lo lleva.
    const id = String(dialogue?.id ?? '').trim();
    const raw = (Array.isArray(lastDialogues) ? lastDialogues : []).find((/** @type {any} */ d) => String(d?.id ?? '').trim() === id) ?? dialogue;
    const follow = dialogueFollow(raw, optionId, outcome);
    if (follow) {
        const day = Math.max(1, campaignDay());
        const sucesoState = readSucesoState(chat_metadata[SUCESOS_KEY]);
        // Sin sitio: vuelve donde estéis ese día.
        chat_metadata[SUCESOS_KEY] = scheduleFollows(sucesoState, { follows: follow, day });
        saveMetadata();
    }
}

/**
 * Las tarjetas de consecuencias diferidas del hilo y de las charlas para sumar a los sucesos.
 * @returns {any[]}
 */
export function getPlotAftermathRows() {
    const plot = getPlot();
    return laterRows(plot, { dialogues: lastDialogues });
}

/**
 * Comprueba que las consecuencias diferidas de un paquete estén bien escritas.
 * @param {any} pack
 * @returns {{errors: Array<{path: string, message: string}>, warnings: Array<{path: string, message: string}>, count: number}}
 */
export function validatePackAftermath(pack) {
    return checkLaters(pack);
}

