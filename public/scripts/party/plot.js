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
import { loadWorldInfo, saveWorldInfo, refreshWorldMapGlobals, METADATA_KEY } from '../world-info.js';
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
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    ACT_STARTS_KEY, ACT_SUMMARIES_KEY, CAMPAIGN_START_KEY, GRAVES_KEY, HERO_FIT_KEY, HINTS_KEY, PLOT_ANNOUNCED_KEY,
    PLOT_KEY, PLOT_STATE_KEY, VILLAIN_SEEN_KEY,
} from './keys.js';
import { combatEncounter, currentLocationName, partyMembers } from './state.js';
import { recordFinishedCampaign } from './hub.js';
import { deliverRelics } from './loot.js';
import { ensureWorldData, lastHubHome } from './world.js';
import { getCurrentWorldFactions, shiftFactionStanding } from './factions.js';
import { campaignDay, getCampaignBonds, getCampaignCalendar } from './time.js';
import { noteDeed, worldWrite, refreshWorldMemoryPrompt } from './world-growth.js';
import { whoPlays, postCombatNarration, tellMoment, postForModel, showTip } from './narration.js';
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
            if (milestone.scene) lines.push(milestone.scene);
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
        if (milestone.scene && !milestone.hidden) lines.push(milestone.scene);
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
        const lines = opening.opened.filter(m => !m.hidden).map(m => m.scene).filter(Boolean);
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
