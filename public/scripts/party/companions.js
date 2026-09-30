/**
 * Los compañeros: sus vínculos y escenas, lo que opinan, lo que dicen en combate, quién se
 * harta y se va, sus hazañas y apodos, los confidentes, los regalos y su tarjeta.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveChatConditional, saveMetadata } from '../../script.js';
import {
    getCurrentWorldLocationMaps, getCurrentWorldEnemies, loadWorldInfo, saveWorldInfo, createWorldInfoEntry,
    refreshWorldMapGlobals, METADATA_KEY,
} from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { homeFavors, noteGone, whoComesBack, comebackOf, forgetGone } from '../game-engine/campaign/companion-arcs.js';
import { stanceOf, STANCES, PREFERENCES, DEFAULT_PREFERENCE } from '../game-engine/combat/ally-ai.js';
import {
    approvalFor, approvalFromOpinions, noteApproval, frictionsOn, describeApproval, approvalOf, DECISIONS,
} from '../game-engine/campaign/approval.js';
import { duePersonalQuests, personalQuestFor, describePersonalAsk } from '../game-engine/campaign/personal-quests.js';
import { readBench, whereHired } from '../game-engine/campaign/bench.js';
import { judgeDepartures, describeWarning, describeLeaving } from '../game-engine/campaign/departures.js';
import { shiftAttitude, describeAttitude, readAttitudes } from '../game-engine/campaign/attitudes.js';
import { readInjuries } from '../game-engine/rules/injuries.js';
import { describeNeeds, relieve } from '../game-engine/rules/needs.js';
import { readRemedies, remediesFor, shouldOfferRetirement } from '../game-engine/rules/remedies.js';
import { chooseBark, opinionOf, wantsOf } from '../game-engine/combat/barks.js';
import { groupMorale, campJobOf, mourningFor } from '../game-engine/campaign/company.js';
import {
    noteFeat, newNickname, traitsOf, desireLine, TRAIT_AT, knacksOf, KNACK_AT,
} from '../game-engine/campaign/feats.js';
import { readRecruits, bondSceneFor, describeMeeting, describeJoin } from '../game-engine/campaign/recruit.js';
import { addMemory } from '../game-engine/campaign/memories.js';
import { STAFF_ROLES } from '../game-engine/campaign/guild.js';
import { readReasons } from '../game-engine/rules/companions.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { isShellOpen, refreshGameShell, setScene } from '../game-engine/ui/shell/game-shell.js';
import { buildCompanionCard, judgeGift } from '../game-engine/ui/shell/companion-card.js';
import {
    readFormation, describeFormation, orderOf, rowOf, moveInOrder, setDuty, dutyHolder, travelRolesOf, DUTIES, ROWS,
} from '../game-engine/campaign/formation.js';
export { orderOf, inMarchOrder, DUTIES, ROWS } from '../game-engine/campaign/formation.js';
import { POPUP_TYPE, Popup } from '../popup.js';
import { skillModifier } from '../game-engine/rules/checks.js';
import { readLineRows, roadLine, reactionLines } from '../game-engine/campaign/companion-lines.js';
import { readCompanionCards, shortOf } from '../game-engine/campaign/companion-cards.js';
import { SOCIAL_KEY, keyOf, readSocial } from '../game-engine/campaign/social.js';
import { getElapsedSlots } from '../game-engine/campaign/calendar.js';
export { readQuestRows, readQuests, currentStep, startQuest, QUESTS_KEY } from '../game-engine/campaign/companion-quests.js';
import {
    readQuestRows, readQuests, currentStep, startQuest, questInfo, questUnderway, afterTravel, afterScene, afterBoard,
    stepScene, endingOf, finishQuest, endingLines, questCard, travelOf, fightOf, QUESTS_KEY,
} from '../game-engine/campaign/companion-quests.js';
import { unlockedFor } from '../game-engine/campaign/meetups.js';
import { buildImportPlan, buildPackEntries } from '../game-engine/campaign/campaign-importer.js';
import { normalizePack } from '../game-engine/campaign/campaign-pack.js';
import { openPlotScene } from '../game-engine/ui/plot-scene.js';
import { openMeetupScene } from '../game-engine/ui/meetup-scene.js';
import {
    campaignCompanions, stayVerdict, stayScene, stayChoice, settleStays, homecomingLine,
} from '../game-engine/campaign/guild-companions.js';
import {
    APPROVAL_KEY, ATTITUDES_KEY, BENCH_KEY, BOARD_KEY, BOARDS_WON_KEY, GONE_KEY, GUILD_KEY, LEAVE_ON_KEY, MEMORIES_KEY, PERSONAL_ASKED_KEY,
    RECRUITS_MET_KEY, WARNED_KEY,
} from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, setCurrentBoardName, setPartyMembers } from './state.js';
import { openOwnSheet } from './sheet.js';
import { canLevelUp, openLevelUpCard } from './level-up.js';
import { retireMember } from './hub.js';
import { hereLocation, lastCompendium, lastConfidantEntries, lastHub, lastPack, lastWorldNpcs, saveCurrentBoard } from './world.js';
import {
    advanceCampaignDay, campaignDay, getCampaignBonds, getCampaignCalendar, recordCampaignBondEvent, spendDayPart,
} from './time.js';
import { noteDeed, refreshWorldMemoryPrompt, worldWrite } from './world-growth.js';
import { offlineGame, postCombatNarration, postForModel } from './narration.js';
import { getActivePartyLeader, memberFromEntry, partyPurse, renderPartyMembers, savePartyState } from './roster.js';
import { smithHere, smithPlaces, buyRemedy } from './town.js';
import { bondFavors, carryBondOf, meetSomeone, meetupData, peopleHere, wantsToMeetAt } from './social.js';
import { canChooseControl, controlOf, CONTROL_LABELS } from './spell-turn.js';
import { chooseControl, startWaitingFight } from './combat-flow.js';
import { applySceneEffectsToGame, storyHero, storyNight, storyWorld } from './plot.js';
import { enterBoard } from './board.js';
import { lastWaiting, renderLocationMapsPreview } from './board-view.js';
import { getGuild } from './contracts.js';
import { rollDiceDetailed } from './combat-rules.js';

/**
 * R8: los favores de la gente de aquí que os aprecia (actitud +2 o más).
 *
 * @returns {ReturnType<typeof homeFavors>}
 */
export function favorsHere() {
    return [
        ...homeFavors({ npcs: lastWorldNpcs, attitudes: readAttitudes(chat_metadata?.[ATTITUDES_KEY]), here: currentLocationName }),
        // J14.3: y lo que ha abierto tu gente con su vínculo (la forja de Gerd, la posada de Osric).
        ...bondFavors(),
    ];
}

/**
 * R8: si vuelve alguien de los que se fueron. Con la semilla del mundo y la semana.
 */
export function welcomeBack() {
    if (!chat_metadata) return;
    const today = campaignDay();
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'vuelve', String(Math.floor(today / 7))));
    const gone = whoComesBack({ raw: chat_metadata[GONE_KEY], today, random });
    if (!gone || partyMembers.some(m => String(m.name) === gone.name)) return;
    const back = comebackOf(gone);
    const hero = partyMembers[0];
    back.member.mapPosition = { ...(hero?.mapPosition ?? {}), locationName: currentLocationName };
    partyMembers.push(back.member);
    chat_metadata[GONE_KEY] = forgetGone(chat_metadata[GONE_KEY], gone.name);
    saveMetadata();
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`🔁 [GRUPO] ${back.line}`);
    void postForModel(back.forModel);
}

/**
 * T7: quien está harto (ya avisó) y puede irse el día de la semana, si los hartos se van en
 * esta partida.
 *
 * @returns {any[]}
 */
export function leavingMembers() {
    if (!chat_metadata?.[LEAVE_ON_KEY]) return [];
    const warned = Array.isArray(chat_metadata[WARNED_KEY]) ? chat_metadata[WARNED_KEY].map(String) : [];
    return partyMembers.filter(m => !m.dead && warned.includes(String(m.id)));
}

/** @returns {import('../game-engine/campaign/recruit.js').Recruit[]} */
export function currentRecruits() {
    return readRecruits({ entries: lastConfidantEntries, party: partyMembers, met: chat_metadata?.[RECRUITS_MET_KEY] });
}

/**
 * Conocer a un confidente: el narrador cuenta la escena de su ficha.
 *
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function meetRecruit(uid) {
    const recruit = currentRecruits().find(r => r.uid === uid);
    if (!recruit || !chat_metadata) return;
    const met = Array.isArray(chat_metadata[RECRUITS_MET_KEY]) ? chat_metadata[RECRUITS_MET_KEY].map(String) : [];
    chat_metadata[RECRUITS_MET_KEY] = [...new Set([...met, uid])];
    saveMetadata();
    await postForModel(describeMeeting(recruit, currentLocationName));
    if (isShellOpen()) refreshGameShell();
}

/**
 * Que un confidente se una al grupo.
 *
 * Su ficha del mundo pasa a ser de personaje: asi la sincronizacion del grupo lo reconoce
 * como de los tuyos y no lo saca al recargar. Se lleva sus escenas de vinculo.
 *
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function hireRecruit(uid) {
    const recruit = currentRecruits().find(r => r.uid === uid);
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!recruit || !worldName) return;
    /** @type {any} */
    let joined = null;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const entry = data?.entries?.[uid]
            ?? Object.values(data?.entries ?? {}).find((/** @type {any} */ e) => String(e?.uid) === uid);
        if (!data || !entry) return;
        entry.dndData = {
            ...entry.dndData,
            entityType: 'character',
            level: Math.max(1, Number(partyMembers[0]?.level) || 1),
            mapPosition: { locationName: currentLocationName, gridX: 0, gridY: 0 },
        };
        joined = memberFromEntry(entry, worldName);
        Object.assign(joined, {
            motive: recruit.motive,
            // Lo que le mueve: de su ficha, o de su motivo y su oficio. Es lo que decide de
            // que opina y como habla en combate.
            reasons: {
                ...(joined.reasons ?? {}),
                wants: wantsOf({ motive: recruit.motive, className: recruit.className, wants: entry.dndData.wants }),
            },
            confidant: true,
            bondScenes: Array.isArray(entry.dndData.bondScenes) ? entry.dndData.bondScenes : [],
            // Idea 45: lo que dice al llegar a cada sitio suyo va con él.
            arrivals: Array.isArray(entry.dndData.arrivals) ? entry.dndData.arrivals : [],
        });
        // Antes de guardar el mundo: al guardarlo se sincroniza el grupo, y tiene que
        // encontrarlo ya dentro para no meterlo dos veces. Idea 42: si no cabe, a casa.
        if (whereHired(partyMembers) === 'bench' && chat_metadata) {
            chat_metadata[BENCH_KEY] = [...readBench(chat_metadata[BENCH_KEY]), joined];
            saveMetadata();
            toastr.info(`${joined.name} se queda en casa, en el gremio: el grupo está lleno.`, 'Contratado');
        } else {
            partyMembers.push(joined);
        }
        savePartyState();
        await saveWorldInfo(worldName, data, true);
        delete lastConfidantEntries[uid];
    });
    if (!joined) return;
    // J14: lo que ya había entre vosotros (las quedadas antes de unirse) pasa a su ficha.
    carryBondOf(joined, 'join');
    renderPartyMembers();
    noteDeed(`${recruit.name} se unió al grupo en ${currentLocationName}.`);
    rememberTogether(`${recruit.name} se unió al grupo en ${currentLocationName}.`, [String(partyMembers[0]?.name ?? ''), recruit.name]);
    await postForModel(describeJoin(recruit));
    if (isShellOpen()) refreshGameShell();
}

/**
 * La escena escrita de un rango de vinculo, al narrador. Sin escena escrita, nada: el
 * aviso de siempre ya dice que el vinculo ha subido.
 *
 * @param {any} member
 * @param {number} rank
 */
export function tellBondScene(member, rank) {
    // J14.3: la escena de cada rango se juega quedando con él. Al subir, se avisa de que quiere
    // quedar contigo; sin conexión no hay narrador a quien contársela.
    if (wantsToMeetAt(member, rank)) {
        const line = `${member.name} quiere quedar contigo: tiene algo que contarte. Búscale en el pueblo.`;
        postCombatNarration(`💞 [VÍNCULO] ${line}`);
        toastr.info(line, `💞 ${member.name}`, { timeOut: 10000 });
        return;
    }
    if (offlineGame()) return;
    const scene = bondSceneFor(member, rank);
    if (!scene) return;
    void postForModel(`[ESCENA DE VÍNCULO · ${member.name}, rango ${rank}${scene.title ? `: ${scene.title}` : ''}] `
        + `${scene.scene} Narra esta escena en tu voz, sin decidir por el jugador.`);
}

/**
 * Apuntar algo que el grupo vivio junto.
 *
 * @param {string} text
 * @param {string[]} who
 */
export function rememberTogether(text, who) {
    if (!chat_metadata) return;
    const day = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    chat_metadata[MEMORIES_KEY] = addMemory(chat_metadata[MEMORIES_KEY], { day, text, who: who.filter(Boolean) });
    saveMetadata();
}

/** Lo ultimo que opino cada uno: no se repite la frase seguida. */
/** @type {Map<string, string>} */
const lastOpinion = new Map();

/**
 * Idea 27: al aceptar un encargo, quien tenga algo que decir lo dice.
 *
 * @param {any} contract
 */
export function voiceOpinions(contract) {
    const said = partyMembers.slice(1)
        .filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .map(m => ({ member: m, opinion: opinionOf(readReasons(m).wants, contract, { last: lastOpinion.get(String(m.id)) ?? '', gender: m.gender ?? '' }) }))
        .filter(x => x.opinion);
    for (const { member, opinion } of said.slice(0, 2)) {
        if (!opinion) continue;
        lastOpinion.set(String(member.id), opinion.line);
        postCombatNarration(`💬 ${member.name}: «${opinion.line}»`);
        toastr.info(`«${opinion.line}»`, `${opinion.mood === 'like' ? '👍' : '👎'} ${member.name}`, { timeOut: 6000 });
    }
    // Idea 28: y lo que opinan cuenta para el vínculo. Ya se ha visto: no se repite.
    judgeDecision('', {
        verdicts: approvalFromOpinions(said, m => readReasons(m).wants, `aceptar «${String(contract?.title ?? 'el encargo')}»`),
        quiet: true,
    });
}

/** La ultima frase, para no repetirla. */
let lastBark = '';

/**
 * Que un companero diga algo, a veces. El tuyo no: sus palabras las pones tu.
 *
 * Es de adorno —no cambia nada y no se le manda al modelo—, asi que usa `Math.random` y no
 * el dado de la partida: no puede mover ninguna tirada de las que si cuentan.
 *
 * @param {any} member
 * @param {string} event
 * @param {string} [about]
 */
export function bark(member, event, about = '') {
    if (!member || String(member.id) === String(partyMembers[0]?.id)) return;
    const line = chooseBark({
        event, wants: readReasons(member).wants, about, last: lastBark, random: Math.random,
        // J1.4: «estoy segura» si lo dice ella; «cubridla» si es ella la que cae.
        gender: member.gender ?? '', aboutGender: partyMembers.find(m => m.name === about)?.gender ?? '',
    });
    if (!line) return;
    lastBark = line;
    postCombatNarration(`💬 ${member.name}: «${line}»`);
    const token = [...document.querySelectorAll('.wm-token')]
        .find(t => t instanceof HTMLElement && t.dataset.tokenId === String(member.id) && t.offsetParent);
    if (!token) return;
    const bubble = document.createElement('div');
    bubble.className = 'wm-bark';
    bubble.textContent = line;
    token.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2600);
}

/**
 * Ideas 28 y 32: lo que les parece a los compañeros lo que acabas de hacer. Suma o resta
 * un punto de vínculo y se ve; y si chocan dos, se cuenta al narrador y pesa en la moral de
 * hoy.
 *
 * @param {string} decision Una de `DECISIONS`, o vacía si ya vienen juzgadas.
 * @param {{verdicts?: any[], quiet?: boolean}} [options] Las ya juzgadas (las opiniones de un
 *   encargo), y si no hace falta enseñarlas otra vez.
 */
export function judgeDecision(decision, { verdicts = undefined, quiet = false } = {}) {
    if (!chat_metadata) return;
    const judged = verdicts ?? approvalFor({ party: partyMembers, decision, wantsOf: m => readReasons(m).wants });
    if (judged.length === 0) return;
    for (const verdict of judged) recordCampaignBondEvent(verdict.id, verdict.mood > 0 ? 'approved' : 'disapproved');
    const { state, friction } = noteApproval(chat_metadata[APPROVAL_KEY], judged, campaignDay());
    chat_metadata[APPROVAL_KEY] = state;
    saveMetadata();
    if (!quiet) toastr.info(describeApproval(judged), `Les parece: ${DECISIONS[decision]?.label ?? judged[0].what}`, { timeOut: 7000 });
    // J13.5: y alguno lo dice en voz alta, con su cara en la novela.
    sayReactions(judged, decision);
    if (friction) {
        postCombatNarration(`⚡ [GRUPO] ${friction.line}`);
        toastr.warning(friction.line, '⚡ Roce en el grupo', { timeOut: 9000 });
        void postForModel(`[ROCE] ${friction.line} Cuéntalo en una o dos frases: discuten, y nadie se va.`);
    }
}

// ---------------------------------------------------------------------------------------
// J13.5: lo que dicen tus compañeros fuera de combate (`campaign/companion-lines.js`).

/** Las fichas de `companeros.json` y las frases de `charlas.json`, leídas una vez por compendio. */
let lineData = { from: /** @type {any} */ (null), cards: /** @type {import('../game-engine/campaign/companion-cards.js').CompanionCard[]} */ ([]), lines: /** @type {import('../game-engine/campaign/companion-lines.js').LineRow[]} */ ([]) };

/** @returns {typeof lineData} */
function lineRows() {
    if (lineData.from !== lastCompendium) {
        lineData = { from: lastCompendium, cards: readCompanionCards(lastCompendium.find('companeros')), lines: readLineRows(lastCompendium.find('charlas')) };
    }
    return lineData;
}

/**
 * J7.2, J13.5 y J14.8: cómo es cada compañero (`compendio/companeros.json`): lo que busca, su
 * nombre corto y si se viene al gremio.
 *
 * @returns {import('../game-engine/campaign/companion-cards.js').CompanionCard[]}
 */
export function companionCards() {
    return lineRows().cards;
}

/**
 * Una frase de un compañero, en la caja de la novela con su retrato y su cara, y para el
 * narrador, que ya no la repite.
 *
 * @param {import('../game-engine/campaign/companion-lines.js').SpokenLine} spoken
 * @param {string} when Cuándo lo dice («por el camino», «al llegar a Vallaki»…), para el narrador.
 */
function sayLine(spoken, when) {
    const mood = spoken.mood || (spoken.feel > 0 ? 'alegre' : spoken.feel < 0 ? 'enfadado' : '');
    void postForModel(`[FRASE] ${spoken.who}, ${when}: «${spoken.line}». Ya se ha dicho: no lo repitas.`,
        { show: `💬 [FRASE] ${spoken.line}`, speaker: spoken.who, mood })
        .catch(error => console.error('[party] companion line failed', error));
}

/** @param {any} state */
function saveLineState(state) {
    if (!chat_metadata) return;
    chat_metadata[SOCIAL_KEY] = readSocial(state);
    saveMetadata();
}

/**
 * J13.5: por el camino (`viaje`) o al llegar (`llegada`), a veces alguien del grupo dice algo.
 * No gasta tiempo ni pide respuesta; no repite hasta agotar las suyas.
 *
 * @param {'viaje'|'llegada'} moment
 * @param {string} [place] El sitio, para las frases que lo nombran.
 * @returns {boolean} Si alguien ha dicho algo.
 */
export function sayRoadLine(moment, place = '') {
    if (!chat_metadata || combatEncounter.active || partyMembers.filter(m => !m.dead).length < 2) return false;
    const { cards, lines } = lineRows();
    const random = createSeededRandom(derive(String(chat_metadata[METADATA_KEY] || ''), 'frase', moment, String(campaignDay()), String(place || currentLocationName)));
    const said = roadLine({ moment, rows: lines, party: partyMembers, social: chat_metadata[SOCIAL_KEY], random, cards, place: String(place || '') });
    if (!said.line) return false;
    saveLineState(said.social);
    sayLine(said.line, moment === 'viaje' ? 'por el camino' : `al llegar a ${place || currentLocationName}`);
    return true;
}

/** La parte del día en que alguien dijo algo de lo que decidisteis: una por parte, como mucho. */
let lastReactionAt = -1;

/**
 * J13.5: ante lo que decidís, lo dice alguien a quien le parece bien o mal (una frase; dos si a
 * uno le gusta y a otro no). Una vez por parte del día: si no, cada decisión de una charla
 * traería su comentario.
 *
 * @param {Array<{id: string, name: string, mood: number}>} judged
 * @param {string} decision
 */
function sayReactions(judged, decision) {
    if (!chat_metadata || combatEncounter.active) return;
    const now = getElapsedSlots(getCampaignCalendar());
    if (now === lastReactionAt) return;
    const { cards, lines } = lineRows();
    const random = createSeededRandom(derive(String(chat_metadata[METADATA_KEY] || ''), 'reaccion', String(decision), String(now)));
    const said = reactionLines({
        opinions: judged.map(v => ({ id: String(v.id), name: String(v.name), mood: /** @type {1|-1} */ (v.mood > 0 ? 1 : -1), trait: String(decision || '') })),
        about: String(decision || ''),
        rows: lines,
        party: partyMembers,
        social: chat_metadata[SOCIAL_KEY],
        random,
        cards,
    });
    if (said.lines.length === 0) return;
    lastReactionAt = now;
    saveLineState(said.social);
    for (const spoken of said.lines) sayLine(spoken, 'ante lo que habéis decidido');
}

/**
 * Idea 140: cambiar cómo mira alguien al grupo, con los límites del motor.
 *
 * @param {string} name
 * @param {number} delta
 * @param {string} why
 * @returns {string}
 */
export function changeAttitude(name, delta, why) {
    if (!chat_metadata) return 'No hay partida.';
    const npc = lastWorldNpcs.find(n => n.name.toLowerCase() === name.trim().toLowerCase());
    if (!npc) return 'No hay nadie así en el mundo.';
    const result = shiftAttitude(chat_metadata[ATTITUDES_KEY], { name: npc.name, delta, day: campaignDay() });
    if (!result.ok) return `No cambia: ${result.reason}`;
    chat_metadata[ATTITUDES_KEY] = result.state;
    saveMetadata();
    const line = `${npc.name} os mira ahora de forma ${describeAttitude(result.value)}${why ? ` (${why})` : ''}.`;
    postCombatNarration(`🤝 [CAMPAÑA] ${line}`);
    toastr.info(line, 'Actitud');
    refreshWorldMemoryPrompt();
    return `Apuntado: ${line}`;
}

/**
 * Idea 29: quien acumula disgustos avisa; si ya avisó y sigue, se va. Solo con la opción
 * puesta en la pausa.
 */
export function weighDepartures() {
    if (!chat_metadata?.[LEAVE_ON_KEY]) return;
    const bonds = getCampaignBonds();
    const warned = Array.isArray(chat_metadata[WARNED_KEY]) ? chat_metadata[WARNED_KEY].map(String) : [];
    const verdict = judgeDepartures({
        party: partyMembers,
        approvalOf: m => approvalOf(chat_metadata?.[APPROVAL_KEY], String(m.id), 30).score,
        rankOf: m => getBondProgress(bonds, String(m.id)).rank,
        warned,
    });
    for (const member of verdict.warn) {
        const line = describeWarning(member);
        warned.push(String(member.id));
        toastr.warning(line, `😠 ${member.name}`, { timeOut: 12000 });
        void postForModel(`[HARTO] ${line} Que lo diga con sus palabras, en una frase.`);
    }
    for (const member of verdict.leave) {
        const line = describeLeaving(member);
        // R8: se apunta, con su ficha, por si un día vuelve.
        if (chat_metadata) chat_metadata[GONE_KEY] = noteGone(chat_metadata[GONE_KEY], member, campaignDay(), 'harto');
        setPartyMembers(partyMembers.filter(m => m !== member));
        noteDeed(line);
        toastr.error(line, `👋 ${member.name}`, { timeOut: 15000 });
        void postForModel(`[SE VA] ${line} Cuenta la despedida en dos frases.`);
    }
    chat_metadata[WARNED_KEY] = warned;
    if (verdict.leave.length > 0) {
        savePartyState();
        renderPartyMembers();
    }
    saveMetadata();
}

/**
 * Idea 39: la moral del grupo, de sus vinculos, su hambre y sus heridas.
 *
 * @returns {{value: -1|0|1, label: string}}
 */
export function partyMorale() {
    const bonds = getCampaignBonds();
    return groupMorale({
        ranks: partyMembers.slice(1).map(m => getBondProgress(bonds, String(m.id)).rank),
        hungry: partyMembers.filter(m => /hambre|sed/i.test(describeNeeds(m))).length,
        wounded: partyMembers.filter(m => (Number(m.hp) || 0) / Math.max(1, Number(m.maxHp) || 1) < 0.5).length,
        size: partyMembers.length,
        mourning: partyMembers.filter(m => mourningFor(m, campaignDay())).length,
        // Idea 32: los roces de hoy también pesan.
        friction: frictionsOn(chat_metadata?.[APPROVAL_KEY], campaignDay()),
    });
}

/**
 * Ideas 44 y 47: apuntar una hazaña, y contar si trae apodo o rasgo nuevo.
 *
 * @param {any} member
 * @param {'kill'|'crit'|'downed'|'rescue'|'hit'} kind
 * @param {string} [about]
 */
export function recordFeat(member, kind, about = '') {
    if (!member) return;
    member.feats = noteFeat(member, kind, about);
    if (kind === 'hit' && about && member.feats.hitsWith[about] === KNACK_AT) {
        const line = `${member.name} le ha cogido el tranquillo a ${about}: +1 al daño con ella.`;
        postCombatNarration(`🗡️ ${line}`);
        toastr.info(line, 'Soltura', { timeOut: 8000 });
        noteDeed(line);
    }
    if (kind === 'kill' && about && member.feats.killsBy[about] === TRAIT_AT) {
        const line = `${member.name} ya sabe cómo pelear contra ${about}: +1 al atacarle.`;
        postCombatNarration(`🎯 ${line}`);
        toastr.info(line, 'Rasgo nuevo', { timeOut: 8000 });
        noteDeed(line);
    }
    checkNickname(member);
}

/**
 * Si alguien se ha ganado un apodo, ponerselo y contarlo.
 *
 * @param {any} member
 */
export function checkNickname(member) {
    const nickname = newNickname(member);
    if (nickname) {
        member.nickname = nickname.name;
        const line = `Desde hoy le llaman ${member.name} «${nickname.name}»: ${nickname.why}.`;
        postCombatNarration(`🏷️ ${line}`);
        toastr.success(line, 'Un apodo', { timeOut: 9000 });
        noteDeed(line);
        rememberTogether(line, [String(member.name)]);
    }
}

/**
 * Idea 30: quien llega a vínculo 3 te pide lo suyo. Va al tablón, con su nombre, y se le
 * ofrece una sola vez.
 */
export function offerPersonalQuests() {
    if (!chat_metadata || !chat_metadata[METADATA_KEY]) return;
    const bonds = getCampaignBonds();
    const asked = Array.isArray(chat_metadata[PERSONAL_ASKED_KEY]) ? chat_metadata[PERSONAL_ASKED_KEY].map(String) : [];
    // J14.9: quien tiene su misión escrita (`personales.json`) la pide él, en su rango, y no
    // un encargo de tablón hecho al azar.
    const announced = announceWrittenQuests(asked);
    const written = new Set(questRows().map(row => row.key));
    const due = duePersonalQuests({
        party: partyMembers.filter(m => !written.has(keyOf(m.name))), rankOf: m => getBondProgress(bonds, String(m.id)).rank, asked,
    });
    if (due.length === 0) {
        if (announced) {
            chat_metadata[PERSONAL_ASKED_KEY] = asked;
            saveMetadata();
        }
        return;
    }
    const places = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name || '')).filter(Boolean);
    // Sin los sitios del mundo cargados todavía, se espera: un encargo en ninguna parte
    // mandaría al grupo a un sitio inventado.
    if (places.length === 0) return;
    const board = Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [];
    const bestiary = getCurrentWorldEnemies().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);
    for (const member of due) {
        const reasons = readReasons(member);
        const random = createSeededRandom(derive(String(chat_metadata[METADATA_KEY] || ''), 'personal', String(member.id)));
        const quest = personalQuestFor({
            member, wants: reasons.wants, hates: reasons.hates, places, here: currentLocationName, bestiary, random, day: campaignDay(),
        });
        board.unshift(quest);
        asked.push(String(member.id));
        const said = describePersonalAsk(member, quest);
        toastr.info(said, `🤝 ${member.name}`, { timeOut: 10000 });
        postCombatNarration(`🤝 [GRUPO] ${said}`);
        void postForModel(`[ENCARGO PERSONAL] ${member.name} le pide al grupo algo suyo: ${quest.title}. Que lo pida con sus palabras, en una o dos frases.`);
    }
    chat_metadata[BOARD_KEY] = board;
    chat_metadata[PERSONAL_ASKED_KEY] = asked;
    saveMetadata();
}

// ---------------------------------------------------------------------------------------
// J14.9: las misiones personales, jugadas (`campaign/companion-quests.js`).

/** Las misiones de `personales.json`, leídas una vez por compendio. */
let questData = { from: /** @type {any} */ (null), rows: /** @type {import('../game-engine/campaign/companion-quests.js').QuestRow[]} */ ([]) };

/** @returns {import('../game-engine/campaign/companion-quests.js').QuestRow[]} */
function questRows() {
    if (questData.from !== lastCompendium) questData = { from: lastCompendium, rows: readQuestRows(lastCompendium.find('personales')) };
    return questData.rows;
}

/** @returns {import('../game-engine/campaign/companion-quests.js').QuestsState} */
function questState() {
    return readQuests(chat_metadata?.[QUESTS_KEY]);
}

/** @param {any} state */
function saveQuestState(state) {
    if (!chat_metadata) return;
    chat_metadata[QUESTS_KEY] = readQuests(state);
    saveMetadata();
}

/**
 * La misión personal de alguien del grupo, si la tiene escrita: cómo va y si su vínculo ya la
 * ha abierto (lo que abre su rango en `quedadas.json`).
 *
 * @param {any} member
 * @returns {{row: import('../game-engine/campaign/companion-quests.js').QuestRow, info: ReturnType<typeof questInfo>,
 *   card: ReturnType<typeof questCard>, open: boolean, rank: number}|null}
 */
export function personalQuestOf(member) {
    const row = questRows().find(r => r.key === keyOf(member?.name));
    if (!row) return null;
    const data = meetupData();
    const info = questInfo(data, row.quest);
    const rank = getBondProgress(getCampaignBonds(), String(member?.id ?? '')).rank;
    const open = unlockedFor(data, row.who, rank).some(u => u.type === 'mision' && String(u.quest?.id ?? '') === row.quest);
    return { row, info, card: questCard(row, questState(), info), open, rank: info?.rank || 4 };
}

/**
 * Avisar, una vez, de que alguien del grupo ya os pide su misión (su vínculo la ha abierto).
 *
 * @param {string[]} asked Lo ya pedido (`PERSONAL_ASKED_KEY`): se le añade `mision:<id>`.
 * @returns {boolean} Si se ha avisado de alguna.
 */
function announceWrittenQuests(asked) {
    let told = false;
    for (const member of partyMembers.slice(1).filter(m => !m.dead)) {
        const quest = personalQuestOf(member);
        if (!quest?.open || asked.includes(`mision:${quest.row.id}`) || questState().quests[quest.row.id]) continue;
        asked.push(`mision:${quest.row.id}`);
        told = true;
        const title = quest.info?.title || quest.row.id;
        const line = `${member.name} tiene algo que pedirte: «${title}». Lo cuenta en su ficha (pulsa su retrato)${lastHub ? '' : ', y se hace desde el gremio'}.`;
        postCombatNarration(`🤝 [GRUPO] ${line}`);
        toastr.info(line, `🤝 ${member.name}`, { timeOut: 12000 });
    }
    return told;
}

/**
 * Una ventana de la misión: lo que se cuenta y uno o dos botones.
 *
 * @param {{title: string, sub?: string, text: string, detail?: string, ok: string, cancel?: string|false, className?: string}} input
 * @returns {Promise<boolean>} Si se pulsó el de seguir.
 */
async function questWindow({ title, sub = '', text, detail = '', ok, cancel = false, className = '' }) {
    const body = $('<div class="pq-root gs-panel"></div>').addClass(className);
    body.append($('<h3 class="gs-popup-title"></h3>').text(title));
    if (sub) body.append($('<div class="fm-title pq-sub"></div>').text(sub));
    for (const part of String(text || '').split('\n').filter(Boolean)) body.append($('<p class="pq-text"></p>').text(part));
    if (detail) body.append($('<p class="pq-detail"></p>').text(detail));
    const answer = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: ok, cancelButton: cancel === false ? false : cancel, allowVerticalScrolling: true, leftAlign: true }).show();
    return Boolean(answer);
}

/**
 * Pasar los días de camino de la misión: cada uno cura y acerca la cuenta, como un viaje; por
 * el camino se duerme, se bebe de la cantimplora y se come (lo dice la ventana: «Por el camino
 * se come»). Sin comer, dos misiones seguidas mataban de hambre a los mercenarios sin avisar:
 * ocho días sin probar bocado es el agotamiento del que no se vuelve.
 *
 * @param {number} days
 */
function passQuestDays(days) {
    for (let day = 0; day < Math.max(0, Math.floor(Number(days) || 0)); day++) {
        advanceCampaignDay();
        for (const member of partyMembers.filter(m => !m.dead)) {
            member.needs = relieve(member, 'slept');
            member.needs = relieve(member, 'drank');
            member.needs = relieve(member, 'ate');
        }
    }
    savePartyState();
}

/**
 * Esperar a que no haya nada delante: ni pelea, ni la tarjeta de la victoria, ni otra ventana.
 *
 * @returns {Promise<void>}
 */
async function questStage() {
    for (let i = 0; i < 600; i++) {
        const busy = combatEncounter.active || document.querySelector('.vs-card') || document.querySelector('dialog[open].qd-dialog, dialog[open].ps-dialog, dialog[open].dw-dialog');
        if (!busy) return;
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

/**
 * Jugar la misión personal de alguien desde donde vaya: empezarla (si su vínculo la abrió y no
 * hay otra a medias) o seguirla. Cada paso a su manera: el camino (sus días), una escena del hilo
 * en su ventana, una pelea en su tablero (sigue sola al acabar) y el final, con lo que cambia.
 * Dejar una escena a medias la deja ahí: se sigue desde su ficha.
 *
 * @param {string} rowId
 * @returns {Promise<string>} El final, si se llegó a uno.
 */
export async function playPersonalQuest(rowId) {
    if (!chat_metadata || combatEncounter.active) return '';
    const row = questRows().find(r => r.id === rowId);
    if (!row) return '';
    if (!lastHub) {
        toastr.info('Las misiones de tu gente del gremio salen de Puerto Alba: se hacen desde el gremio.', 'Misión personal');
        return '';
    }
    const info = questInfo(meetupData(), row.quest);
    const title = info?.title || row.id;
    let state = questState();
    if (!state.quests[row.id]) {
        const other = questUnderway(state);
        if (other) {
            toastr.info(`Primero hay que acabar la misión de ${other.who}.`, 'Misión personal');
            return '';
        }
        const go = await questWindow({
            title, sub: `La misión de ${row.who}`, text: info?.pitch || '', detail: info?.where ? `Dónde: ${info.where}.` : '',
            ok: 'Ir con él', cancel: 'Ahora no',
        });
        if (!go) return '';
        state = startQuest(state, row, { day: campaignDay() });
        saveQuestState(state);
        noteDeed(`${row.who} os pidió ayuda con lo suyo: ${title}.`);
    }
    for (let guard = 0; guard < 24; guard++) {
        const step = currentStep(row, state);
        if (!step) break;
        if (step.kind === 'viaje') {
            const trip = travelOf(step);
            const days = Number(trip?.days) || 1;
            const go = await questWindow({
                title, sub: step.title || `Camino de ${trip?.to || 'su destino'}`, text: trip?.text || '',
                detail: `${days === 1 ? 'Un día' : `${days} días`} de camino hasta ${trip?.to || 'su destino'}. Por el camino se come, se cura y corre la semana.`,
                ok: 'En marcha', cancel: 'Ahora no',
            });
            if (!go) return '';
            passQuestDays(days);
            state = afterTravel(state, row);
            saveQuestState(state);
            continue;
        }
        if (step.kind === 'escena') {
            const hero = storyHero();
            const scene = stepScene(step, { hero, party: partyMembers, questTitle: title });
            if (scene.kind !== 'scene') {
                state = afterScene(state, row, []);
                saveQuestState(state);
                continue;
            }
            await questStage();
            const result = await openPlotScene({
                scene,
                hero,
                getWorld: (who) => storyWorld(who),
                rollD20: () => rollDiceDetailed('1d20', 20).total,
                applyEffects: (effects, context) => applySceneEffectsToGame(effects, { roll: context.roll, hero }),
                pack: lastPack,
                // Pasa lejos de aquí: sin el escenario de Puerto Alba detrás; el suyo, si lo dice el paso.
                town: '',
                night: storyNight(),
            });
            if (!result.finished) return '';
            state = afterScene(state, row, result.choices);
            saveQuestState(state);
            continue;
        }
        if (step.kind === 'tablero') {
            const fight = fightOf(step);
            if (!fight) {
                state = afterBoard(state, row, 'win');
                saveQuestState(state);
                continue;
            }
            await questWindow({ title, sub: step.title || 'Hay que pelear', text: fight.text, ok: 'A pelear' });
            const placed = await placeQuestBoard(row, fight);
            if (!placed) {
                // Sin tablero no se puede pelear: la misión no se queda colgada.
                state = afterBoard(state, row, 'win');
                saveQuestState(state);
                continue;
            }
            enterBoard(placed);
            renderLocationMapsPreview();
            if (isShellOpen()) setScene('combat');
            await new Promise(resolve => setTimeout(resolve, 300));
            if (lastWaiting.board === placed && lastWaiting.placements.length > 0) startWaitingFight(lastWaiting.placements);
            // Sigue sola al acabar la pelea (`questAfterFight`).
            return '';
        }
        if (step.kind === 'final') return await finishPersonalQuest(row, step, info, title);
    }
    return '';
}

/**
 * El final: lo que cuesta, lo que une (cuenta como misión juntos, y una personal pesa el doble),
 * el renombre del gremio, lo que él recuerda y la vuelta a casa. Queda en el Diario.
 *
 * @param {import('../game-engine/campaign/companion-quests.js').QuestRow} row
 * @param {import('../game-engine/campaign/companion-quests.js').QuestStep} step
 * @param {ReturnType<typeof questInfo>} info
 * @param {string} title
 * @returns {Promise<string>}
 */
async function finishPersonalQuest(row, step, info, title) {
    const ending = endingOf(step, info);
    if (!ending || !chat_metadata) return '';
    const member = partyMembers.find(m => keyOf(m.name) === row.key && !m.dead);
    if (ending.gold < 0) payFromPartyUpTo(-ending.gold);
    else if (ending.gold > 0 && partyMembers[0]) partyMembers[0].gold = (Number(partyMembers[0].gold) || 0) + ending.gold;
    if (member) for (let i = 0; i < ending.bonds; i++) recordCampaignBondEvent(String(member.id), 'quest_together');
    if (ending.fame > 0) {
        const guild = getGuild();
        chat_metadata[GUILD_KEY] = { ...guild, renown: (Number(guild.renown) || 0) + ending.fame };
    }
    if (ending.memory) rememberTogether(ending.memory, [String(partyMembers[0]?.name ?? ''), row.who]);
    passQuestDays(ending.back);
    saveQuestState(finishQuest(questState(), row, ending, { day: campaignDay() }));
    savePartyState();
    const lines = endingLines({ who: row.who, ending, short: shortOf(companionCards(), row.who) });
    noteDeed(`${title}, con ${row.who}: ${ending.title}.`);
    postCombatNarration(`🤝 [MISIÓN] ${title} · ${ending.title}. ${lines.join(' ')}`);
    await questWindow({
        title, sub: `Final: ${ending.title}`, text: lines.join('\n'),
        detail: ending.back > 0 ? `${ending.back === 1 ? 'Un día' : `${ending.back} días`} de vuelta a Puerto Alba.` : '',
        ok: 'Volver a Puerto Alba', className: 'pq-ending-window',
    });
    if (isShellOpen()) refreshGameShell();
    return ending.id;
}

/** @param {number} amount Pagar lo que se pueda, sin quedarse en negativo. */
function payFromPartyUpTo(amount) {
    let owed = Math.max(0, Math.floor(Number(amount) || 0));
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
    }
}

/**
 * El tablero de la pelea de una misión, en el sitio de ahora (Puerto Alba), con sus bichos en
 * el mundo, como mete los suyos una campaña. Se quita al acabar la pelea.
 *
 * @param {import('../game-engine/campaign/companion-quests.js').QuestRow} row
 * @param {{board: any, bestiary: any[]}} fight
 * @returns {Promise<string>} El nombre del tablero, o vacío si no se pudo.
 */
async function placeQuestBoard(row, fight) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !currentLocationName) return '';
    const pack = { world: { name: worldName }, boards: [{ ...fight.board, locationName: currentLocationName }], bestiary: fight.bestiary };
    const plan = buildImportPlan(pack);
    const board = (plan.metadata.locationMaps ?? []).flatMap((/** @type {any} */ l) => l.boards ?? [])[0];
    if (!board) return '';
    board.questBoard = row.id;
    let placed = '';
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const place = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l?.name === currentLocationName);
        if (!data || !place) return;
        place.boards = (Array.isArray(place.boards) ? place.boards : []).filter((/** @type {any} */ b) => b?.name !== board.name);
        place.boards.push(board);
        const named = new Set(Object.values(data.entries ?? {}).map((/** @type {any} */ e) => keyOf(e?.dndData?.name || e?.comment)));
        const { pack: clean } = normalizePack(pack);
        for (const spec of buildPackEntries(clean).filter(s => s.group === 'Monsters')) {
            if (named.has(keyOf(spec.title))) continue;
            const entry = /** @type {any} */ (createWorldInfoEntry(worldName, data));
            if (!entry) continue;
            Object.assign(entry, { comment: spec.title, key: spec.keys, content: spec.content, group: spec.group, dndData: spec.dndData });
            named.add(keyOf(spec.title));
        }
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        placed = String(board.name);
    });
    // Una pelea de misión se pelea cada vez que se llega a ella: no cuenta como ya ganada.
    const won = Array.isArray(chat_metadata?.[BOARDS_WON_KEY]) ? chat_metadata[BOARDS_WON_KEY] : null;
    if (placed && won && chat_metadata) {
        chat_metadata[BOARDS_WON_KEY] = won.filter((/** @type {string} */ k) => k !== `${currentLocationName}::${placed}`);
        saveMetadata();
    }
    return placed;
}

/**
 * Quitar del sitio el tablero de una misión, ya peleado.
 *
 * @param {string} rowId
 */
async function removeQuestBoard(rowId) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data?.metadata) return;
        for (const place of data.metadata.locationMaps ?? []) {
            if (Array.isArray(place?.boards)) place.boards = place.boards.filter((/** @type {any} */ b) => b?.questBoard !== rowId);
        }
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
    });
}

/**
 * Tras una pelea: si era la de una misión personal, sigue por donde diga cómo acabó (ganar,
 * perder o huir), fuera del tablero, que se quita.
 *
 * @param {string} reason Cómo acabó (`victory`, `defeat`, `fled`…).
 * @param {string} boardName
 * @returns {Promise<void>}
 */
export async function questAfterFight(reason, boardName) {
    if (!chat_metadata || !lastHub) return;
    const state = questState();
    const going = questUnderway(state);
    const row = going ? questRows().find(r => r.id === going.id) : null;
    const step = row ? currentStep(row, state) : null;
    const fight = step?.kind === 'tablero' ? fightOf(step) : null;
    if (!row || !fight || String(fight.board?.name ?? '') !== String(boardName || '')) return;
    saveQuestState(afterBoard(state, row, reason === 'defeat' ? 'lose' : reason === 'fled' ? 'flee' : 'win'));
    await questStage();
    if (currentBoardName) {
        setCurrentBoardName('');
        saveCurrentBoard();
    }
    await removeQuestBoard(row.id);
    renderLocationMapsPreview();
    if (isShellOpen()) {
        setScene('exploration');
        refreshGameShell();
    }
    await playPersonalQuest(row.id);
}

/**
 * J14.9: las misiones personales, para el Diario: de quién, cómo van y cómo acabaron.
 *
 * @returns {string[]}
 */
export function personalQuestJournal() {
    if (!chat_metadata) return [];
    const state = questState();
    /** @type {string[]} */
    const lines = [];
    for (const row of questRows()) {
        const one = state.quests[row.id];
        const member = partyMembers.find(m => keyOf(m.name) === row.key);
        const quest = member ? personalQuestOf(member) : null;
        if (!one && !quest?.open) continue;
        const card = questCard(row, state, questInfo(meetupData(), row.quest));
        const how = card.done ? `terminada: ${card.ending || 'hecha'}` : one ? card.next.toLowerCase() : 'sin empezar (en su ficha)';
        lines.push(`${card.title}, con ${row.who}: ${how}.`);
    }
    return lines;
}

/**
 * Lo que la ficha de un compañero dice de su misión: el título, de qué va, cómo va, y el botón
 * de empezarla o seguirla. Sin misión escrita, nada.
 *
 * @param {any} member
 * @param {() => void} close Cierra la ficha antes de jugarla.
 * @returns {JQuery<HTMLElement>|null}
 */
function questBox(member, close) {
    const quest = personalQuestOf(member);
    if (!quest) return null;
    const box = $('<div class="cc-quest"></div>').attr('data-quest', quest.row.id);
    const title = quest.info?.title || quest.row.id;
    if (!quest.open) {
        box.append($('<div class="cc-quest-title"></div>').text('Algo le pesa'));
        box.append($('<div class="cc-quest-line"></div>').text(`Cuando os conozcáis más (vínculo ${quest.rank}), te lo contará.`));
        return box;
    }
    box.append($('<div class="cc-quest-title"></div>').text(`Su misión: ${title}`));
    if (quest.info?.pitch) box.append($('<div class="cc-quest-line"></div>').text(quest.info.pitch));
    box.append($('<div class="cc-quest-line cc-quest-state"></div>').text(quest.card.done ? `Terminada: ${quest.card.ending}` : quest.card.next));
    if (quest.card.done) return box;
    const other = questUnderway(questState());
    const busy = Boolean(other && other.id !== quest.row.id);
    const started = Boolean(questState().quests[quest.row.id]);
    const go = $('<button type="button" class="menu_button cc-btn cc-quest-go"></button>')
        .append(`<i class="fa-solid ${started ? 'fa-route' : 'fa-hand-holding-heart'}"></i>`)
        .append($('<span></span>').text(started ? ' Seguir con su misión' : ' Acompañarle'))
        .prop('disabled', busy || !lastHub || combatEncounter.active)
        .attr('title', busy ? `Primero, la misión de ${other?.who}.` : !lastHub ? 'Se hace desde el gremio, en Puerto Alba.' : 'Gasta días de camino.');
    go.on('click', () => {
        close();
        void playPersonalQuest(quest.row.id);
    });
    box.append(go);
    if (!lastHub) box.append($('<div class="cc-quest-line"></div>').text('Se hace desde el gremio, en Puerto Alba.'));
    return box;
}

/**
 * Lo que el lider lleva encima y puede dar.
 *
 * Lo equipado no se regala: quitarle a alguien la espada que esta empunando en mitad de
 * una conversacion es una forma rara de hacer amigos.
 *
 * @param {any} giver
 * @returns {any[]}
 */
function giveableItems(giver) {
    const equipped = new Set(Object.values(giver?.equippedItems || {}).filter(Boolean));
    return (Array.isArray(giver?.items) ? giver.items : []).filter(item => item && !equipped.has(item.id));
}

/**
 * Regala un objeto: lo cambia de manos y anota lo que le ha parecido.
 *
 * @param {any} giver
 * @param {any} member
 * @param {any} item
 */
function giveGift(giver, member, item) {
    const verdict = judgeGift({ member, item });

    giver.items = (Array.isArray(giver.items) ? giver.items : []).filter(i => i.id !== item.id);
    member.items = [...(Array.isArray(member.items) ? member.items : []), item];
    savePartyState();
    renderPartyMembers();

    postCombatNarration(`🎁 [VINCULO] ${verdict.line}`);
    if (verdict.event) recordCampaignBondEvent(String(member.id), verdict.event);
    if (isShellOpen()) refreshGameShell();
}

/** Cierra la ficha de companero, si hay alguna. */
function closeCompanionCard() {
    $('.cc-overlay').remove();
}

/**
 * La ficha de un companero, al pulsar su cara en la tira del grupo.
 *
 * Abrirla no gasta nada — mirar es gratis —; lo que gasta son sus botones: pasar tiempo
 * se lleva un bloque del dia y regalar se lleva el objeto.
 *
 * @param {string} memberId
 */
export function openCompanionCard(memberId) {
    closeCompanionCard();

    const member = partyMembers.find(m => String(m.id) === String(memberId));
    if (!member) return;

    // El tuyo no es un companero: es tu ficha. Y la ficha que se abre es **la de mirar**,
    // no la de editar — el editor tiene desplegables, facciones con casillas y las seis
    // caracteristicas como campos que se escriben, que es lo ultimo que quieres delante
    // en mitad de una partida. Se llega a el desde un boton de la propia ficha.
    const yours = partyMembers[0];
    if (yours && String(yours.id) === String(member.id)) {
        void openOwnSheet(member);
        return;
    }

    const giver = getActivePartyLeader();
    const giverItems = giver && String(giver.id) !== String(member.id) ? giveableItems(giver) : [];
    const card = buildCompanionCard({
        member,
        bonds: getCampaignBonds(),
        calendar: getCampaignCalendar(),
        fighting: combatEncounter.active,
        canLevel: canLevelUp(member),
        giverItems,
    });

    const root = $('<div class="cc-card"></div>');
    // Un clic dentro de la tarjeta no la cierra: cerrarla es el fondo o su boton.
    root.on('click', (event) => event.stopPropagation());

    const head = $('<div class="cc-head"></div>');
    if (card.avatar) head.append($('<img class="cc-avatar">').attr('src', card.avatar).attr('alt', ''));
    const who = $('<div></div>');
    who.append($('<div class="cc-name"></div>').text(card.name));
    who.append($('<div class="cc-rank"></div>').text(card.rankLabel));
    head.append(who);
    root.append(head);

    const bar = $('<div class="cc-bar"></div>');
    bar.append($('<div class="cc-fill"></div>').css('width', `${Math.round(card.progress * 100)}%`));
    root.append(bar);
    root.append($('<div class="cc-points"></div>').text(
        card.maxed ? `${card.points} puntos` : `${card.points} / ${card.nextAt} para el rango ${card.rank + 1}`,
    ));
    // Idea 38: que quiere ahora, en una linea. Y lo que se ha ganado (44, 47, 56).
    const needs = describeNeeds(member);
    const wants = desireLine({
        mourning: mourningFor(member, Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1))),
        wants: readReasons(member).wants,
        hpPct: Math.round(((Number(member.hp) || 0) / Math.max(1, Number(member.maxHp) || 1)) * 100),
        hungry: /hambre|sed/i.test(needs),
        tired: /sueño/i.test(needs),
        gender: member.gender ?? '',
    });
    if (wants) root.append($('<div class="cc-wants"></div>').text(`Ahora: ${wants}`));
    // Idea 28: lo que le ha parecido lo último que hicisteis.
    const liked = approvalOf(chat_metadata?.[APPROVAL_KEY], String(member.id));
    if (liked.recent.length > 0) {
        const box = $('<div class="cc-approval"></div>');
        box.append($('<div class="cc-approval-title"></div>').text('Lo último que le ha parecido'));
        for (const line of liked.recent) box.append($('<div class="cc-approval-line"></div>').text(line));
        root.append(box);
    }
    const earned = [
        member.nickname ? `Le llaman «${member.nickname}»` : '',
        ...traitsOf(member).map(t => t.label),
        ...knacksOf(member),
        ...(Array.isArray(member.scars) ? member.scars : []),
    ].filter(Boolean);
    if (earned.length > 0) root.append($('<div class="cc-earned"></div>').text(earned.join(' · ')));
    // Idea 41: lo que hace fuera del combate.
    const job = campJobOf(member);
    if (job) root.append($('<div class="cc-job"></div>').text(`${job.label}: ${job.effect}`));
    // J14.9: su misión personal, si la tiene escrita: se abre con el vínculo y se juega desde aquí.
    const quest = questBox(member, () => closeCompanionCard());
    if (quest) root.append(quest);
    // Idea 35: a quien va primero.
    const preferRow = $('<div class="cc-stance cc-prefer"></div>');
    preferRow.append($('<div class="cc-stance-title"></div>').text('Va primero a'));
    const prefer = String(member.prefer || DEFAULT_PREFERENCE);
    for (const [id, option] of Object.entries(PREFERENCES)) {
        const pick = $('<button class="menu_button cc-prefer-btn" type="button"></button>')
            .attr('data-prefer', id)
            .attr('title', option.description)
            .toggleClass('active', id === prefer)
            .append(`<i class="fa-solid ${option.icon}"></i>`)
            .append($('<span></span>').text(` ${option.label}`));
        pick.on('click', () => {
            member.prefer = id;
            savePartyState();
            preferRow.find('.cc-prefer-btn').removeClass('active');
            pick.addClass('active');
        });
        preferRow.append(pick);
    }
    root.append(preferRow);

    // Como pelea cuando no lo llevas tu. Un clic, y vale tambien en mitad de un combate:
    // es justo cuando se ve que la que tenia no era la buena.
    const stanceRow = $('<div class="cc-stance"></div>');
    stanceRow.append($('<div class="cc-stance-title"></div>').text('En combate'));
    const current = stanceOf(member);
    for (const [id, stance] of Object.entries(STANCES)) {
        const pick = $('<button class="menu_button cc-stance-btn" type="button"></button>')
            .attr('data-stance', id)
            .attr('title', stance.description)
            .toggleClass('active', id === current)
            .append(`<i class="fa-solid ${stance.icon}"></i>`)
            .append($('<span></span>').text(` ${stance.label}`));
        pick.on('click', () => {
            setMemberStance(member, id);
            stanceRow.find('.cc-stance-btn').removeClass('active');
            pick.addClass('active');
        });
        stanceRow.append(pick);
    }
    root.append(stanceRow);

    // J7.3 y D-J32: desde el vínculo de amigo (5), en los dos modos de campaña, eliges quién le
    // mueve en combate. Antes solo sale su postura: le mueve el juego. Vale a mitad de pelea.
    if (canChooseControl(member)) {
        const controlRow = $('<div class="cc-stance cc-control"></div>');
        controlRow.append($('<div class="cc-stance-title"></div>').text('Quién le mueve'));
        for (const side of /** @type {Array<'player'|'engine'>} */ (['player', 'engine'])) {
            const pick = $('<button class="menu_button cc-stance-btn cc-control-btn" type="button"></button>')
                .attr('data-control', side)
                .attr('title', side === 'player' ? 'En su turno le mueves tú, como a tu personaje.' : 'En su turno decide solo, con la postura de arriba.')
                .toggleClass('active', controlOf(member) === side)
                .append(`<i class="fa-solid ${side === 'player' ? 'fa-hand-pointer' : 'fa-robot'}"></i>`)
                .append($('<span></span>').text(` ${CONTROL_LABELS[side]}`));
            pick.on('click', () => {
                chooseControl(member, side);
                controlRow.find('.cc-control-btn').removeClass('active');
                controlRow.find(`.cc-control-btn[data-control="${controlOf(member)}"]`).addClass('active');
            });
            controlRow.append(pick);
        }
        root.append(controlRow);
    }

    // Lo que no cura. Un remedio cuesta oro; quedarse en casa cuesta tenerle a tu lado.
    const table = readRemedies();
    const remedies = remediesFor(member, partyPurse(), table);
    const lasting = readInjuries(member).filter(injury => injury.permanent);
    if (lasting.length > 0) {
        const box = $('<div class="cc-remedies"></div>');
        box.append($('<div class="cc-remedy-title"></div>').text(
            `Arrastra: ${lasting.map(injury => injury.label.toLowerCase()).join(', ')}.`));
        // Los remedios los hace un herrero (DL1): aqui se dice donde hay uno.
        if (remedies.length > 0 && !smithHere()) {
            const where = smithPlaces();
            box.append($('<div class="cc-remedy-title"></div>').text(where.length > 0
                ? `Esto lo hace un herrero: en ${where.slice(0, 3).join(', ')}.`
                : 'Esto lo hace un herrero, y por aquí no hay ninguno.'));
        }
        for (const option of remedies) {
            const buy = $('<button class="menu_button cc-remedy-btn" type="button"></button>')
                .attr('data-remedy', option.injuryId)
                .attr('title', option.remedy.description)
                .prop('disabled', combatEncounter.active || !option.affordable || !smithHere())
                .text(`${option.remedy.label} — ${option.remedy.cost} de oro`);
            buy.on('click', () => {
                closeCompanionCard();
                buyRemedy(member, option.injuryId);
            });
            box.append(buy);
        }

        if (!combatEncounter.active) {
            box.append($('<div class="cc-remedy-title"></div>').text(shouldOfferRetirement(member)
                ? 'Ya no está para salir. Puede quedarse en casa:'
                : 'O quedarse en casa, si lo prefieres:'));
            for (const [role, job] of Object.entries(STAFF_ROLES)) {
                const stay = $('<button class="menu_button cc-remedy-btn" type="button"></button>')
                    .attr('data-retire', role)
                    .attr('title', job.describe)
                    .text(`${job.label}: ${job.describe}`);
                stay.on('click', () => {
                    closeCompanionCard();
                    retireMember(member, role);
                });
                box.append(stay);
            }
        }
        root.append(box);
    }

    const actions = $('<div class="cc-actions"></div>');
    for (const action of card.actions) {
        const button = $('<button class="menu_button cc-btn" type="button"></button>');
        button.append(`<i class="fa-solid ${action.icon}"></i>`);
        button.append($('<span></span>').text(` ${action.label}`));
        button.attr('title', action.why);
        button.prop('disabled', !action.enabled);
        button.on('click', () => {
            if (action.id === 'level') {
                closeCompanionCard();
                void openLevelUpCard(member);
                return;
            }

            if (action.id === 'downtime') {
                closeCompanionCard();
                // J14.3: en un pueblo, pasar tiempo con alguien es quedar: su escena, y la parte
                // del día. Fuera (en el camino, en una cueva), un rato juntos como siempre.
                if (peopleHere().people.some(p => p.canMeet && p.key === keyOf(member.name))) {
                    void meetSomeone(String(member.name));
                    return;
                }
                recordCampaignBondEvent(String(member.id), 'shared_downtime');
                spendDayPart('quedar', { who: String(member.name) });
                return;
            }
            if (action.id === 'gift') {
                renderGiftList();
                return;
            }
            closeCompanionCard();
            recordCampaignBondEvent(String(member.id), action.id.slice('event:'.length));
        });
        actions.append(button);
    }
    root.append(actions);

    const gifts = $('<div class="cc-gifts"></div>');
    root.append(gifts);

    function renderGiftList() {
        if (gifts.children().length > 0) {
            gifts.empty();
            return;
        }
        gifts.append($('<div class="cc-gifts-title"></div>').text('Lo que llevas encima'));
        for (let index = 0; index < card.gifts.length; index++) {
            const gift = card.gifts[index];
            const item = giverItems[index];
            const button = $('<button class="menu_button cc-gift" type="button"></button>').text(gift.name);
            // Lo que va a pasar se dice antes de pulsar, no despues.
            button.attr('title', gift.verdict.points === 0
                ? 'No le dice nada en especial'
                : `${gift.verdict.points > 0 ? '+' : ''}${gift.verdict.points} al vínculo`);
            button.on('click', () => {
                closeCompanionCard();
                giveGift(giver, member, item);
            });
            gifts.append(button);
        }
    }

    const close = $('<button class="menu_button cc-btn cc-close" type="button"></button>').text('Cerrar');
    close.on('click', () => closeCompanionCard());
    root.append(close);

    $('body').append($('<div class="cc-overlay"></div>').on('click', () => closeCompanionCard()).append(root));
}

/**
 * Cambiar la postura de alguien.
 *
 * @param {any} member
 * @param {string} stance
 * @returns {string}
 */
export function setMemberStance(member, stance) {
    if (!(stance in STANCES)) return '';
    member.stance = stance;
    savePartyState();
    const label = STANCES[/** @type {keyof typeof STANCES} */ (stance)].label;
    toastr.info(`${member.name}: ${label.toLowerCase()}.`);
    return `${member.name}: ${label}`;
}

/** Clave de guardado para la formación del grupo. */
export const FORMATION_KEY = 'party_formation';

/**
 * Lee la formación guardada del grupo.
 * @returns {import('../game-engine/campaign/formation.js').Formation}
 */
export function getPartyFormation() {
    return readFormation(chat_metadata?.[FORMATION_KEY]);
}

/**
 * Describe la formación actual del grupo en una frase.
 * @returns {string}
 */
export function describePartyFormation() {
    const formation = getPartyFormation();
    return describeFormation(formation, partyMembers);
}

/**
 * J7.4: la formación, por nombres, para llevarla con el grupo a otro chat (del gremio a una
 * campaña y de vuelta): allí cada uno puede tener otro id, pero el mismo nombre.
 *
 * @returns {{order: string[], duties: Record<string, string>}}
 */
export function packFormation() {
    const formation = getPartyFormation();
    const nameOf = (/** @type {string} */ id) => String(partyMembers.find(m => String(m.id) === String(id))?.name ?? '');
    return {
        order: formation.order.map(nameOf).filter(Boolean),
        duties: Object.fromEntries(Object.entries(formation.duties).map(([duty, id]) => [duty, id ? nameOf(id) : ''])),
    };
}

/**
 * Y al llegar: la misma formación con los ids de aquí. Si no se había elegido nada, nada.
 *
 * @param {{order?: string[], duties?: Record<string, string>}|null} carried
 */
export function unpackFormation(carried) {
    if (!chat_metadata || !carried) return;
    const chosen = (carried.order ?? []).length > 0 || Object.values(carried.duties ?? {}).some(Boolean);
    if (!chosen) return;
    const idOf = (/** @type {string} */ name) => String(partyMembers.find(m => String(m.name) === String(name))?.id ?? '');
    chat_metadata[FORMATION_KEY] = readFormation({
        order: (carried.order ?? []).map(idOf).filter(Boolean),
        duties: Object.fromEntries(Object.entries(carried.duties ?? {}).map(([duty, name]) => [duty, name ? idOf(name) : ''])),
    });
    saveMetadata();
}

/** Los papeles que se eligen en la ventana: los que el juego ya usa (quién habla, todavía no). */
const FORMATION_DUTIES = ['cura', 'guia', 'vigia', 'cazador'];

/** Los del camino (`travel-roles.js`): uno por persona. */
const ROAD_DUTIES = ['guia', 'vigia', 'cazador'];

/**
 * J7.4: la formación y los papeles, en su ventana (desde «Grupo» o desde «Tu gente» en el gremio).
 * El orden de la marcha, con flechas: quien va delante abre la marcha en el tablero, entra el
 * primero y se lleva el primer golpe de una emboscada. Y quién cura al acabar una pelea, quién
 * guía, quién vigila (también la primera guardia de la noche) y quién caza por el camino. Lo que
 * se deja en «Lo decide el juego» lo elige el juego, como antes, y se dice a quién.
 *
 * @returns {Promise<void>}
 */
export async function openFormationPanel() {
    if (!chat_metadata) return;
    const members = () => partyMembers.filter(m => !m.dead);
    const body = $('<div class="fm-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text('Formación y papeles'));
    body.append($('<p class="fm-sub"></p>').text('Quién va delante y quién hace cada cosa. Lo que dejes en «Lo decide el juego» lo elige el juego.'));
    const summary = $('<div class="fm-summary"></div>');
    const march = $('<div class="fm-march"></div>');
    const duties = $('<div class="fm-duties"></div>');
    body.append(summary, $('<div class="fm-title"></div>').text('El orden de marcha'), march, $('<div class="fm-title"></div>').text('Los papeles'),
        $('<p class="fm-sub"></p>').text('En el camino, cada uno hace un solo papel: guiar, vigilar o cazar.'), duties);
    if (members().length < 2) body.append($('<p class="fm-alone"></p>').text('Vas sin compañeros: la formación eres tú. Contrata a alguien o busca quien se una.'));

    /** @param {import('../game-engine/campaign/formation.js').Formation} formation */
    const save = (formation) => {
        if (!chat_metadata) return;
        chat_metadata[FORMATION_KEY] = readFormation(formation);
        saveMetadata();
        draw();
    };
    /** Quién haría un papel si lo decide el juego. */
    const byGame = (/** @type {string} */ duty, /** @type {any[]} */ list) => {
        const free = setDuty(getPartyFormation(), duty, '');
        if (duty === 'cura') return dutyHolder(free, 'cura', list)?.name ?? '';
        const roles = travelRolesOf({ formation: free, party: list.filter(m => (Number(m.hp) || 0) > 0), modifierOf: (m, skill) => skillModifier(m, skill).modifier });
        return roles.find(r => r.role === duty)?.name ?? '';
    };
    function draw() {
        const formation = getPartyFormation();
        const list = members();
        summary.text(describeFormation(formation, list) || 'Sin nadie en el grupo.');
        march.empty();
        const order = orderOf(formation, list);
        order.forEach((id, index) => {
            const member = list.find(m => String(m.id) === id);
            if (!member) return;
            const row = $('<div class="fm-row"></div>').attr('data-member', id);
            row.append($('<span class="fm-place"></span>').text(ROWS[rowOf(index, order.length)]));
            row.append($('<span class="fm-name"></span>').text(String(member.name)));
            const up = $('<button type="button" class="menu_button fm-up" title="Más adelante"><i class="fa-solid fa-arrow-up"></i></button>').prop('disabled', index === 0);
            const down = $('<button type="button" class="menu_button fm-down" title="Más atrás"><i class="fa-solid fa-arrow-down"></i></button>').prop('disabled', index === order.length - 1);
            up.on('click', () => save(moveInOrder(getPartyFormation(), members(), id, -1)));
            down.on('click', () => save(moveInOrder(getPartyFormation(), members(), id, 1)));
            row.append(up, down);
            march.append(row);
        });
        duties.empty();
        for (const duty of FORMATION_DUTIES) {
            const spec = DUTIES[/** @type {keyof typeof DUTIES} */ (duty)];
            const row = $('<div class="fm-duty"></div>').attr('data-duty', duty);
            const words = $('<div class="fm-duty-words"></div>');
            words.append($('<div class="fm-duty-name"></div>').text(spec.label));
            words.append($('<div class="fm-duty-does"></div>').text(spec.does));
            row.append(words);
            const auto = byGame(duty, list);
            const pick = $('<select class="fm-pick"></select>')
                .append($('<option value=""></option>').text(auto ? `Lo decide el juego (ahora, ${shortOf(companionCards(), auto)})` : 'Lo decide el juego'));
            for (const member of list) pick.append($('<option></option>').attr('value', String(member.id)).text(String(member.name)));
            pick.val(formation.duties[duty] || '');
            pick.on('change', () => {
                const who = String(pick.val() || '');
                let next = setDuty(getPartyFormation(), duty, who);
                // En el camino, cada uno hace un solo papel: si ya hacía otro, ese lo decide el juego.
                if (who && ROAD_DUTIES.includes(duty)) {
                    for (const other of ROAD_DUTIES) if (other !== duty && next.duties[other] === who) next = setDuty(next, other, '');
                }
                save(next);
            });
            row.append(pick);
            duties.append(row);
        }
    }
    draw();
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Hecho', allowVerticalScrolling: true, leftAlign: true }).show();
    if (isShellOpen()) refreshGameShell();
}

// ---------------------------------------------------------------------------------------
// J7.2: los compañeros de una campaña que se vienen al gremio (`campaign/guild-companions.js`).

/**
 * @typedef {Object} CampaignStays Lo que se decidió al acabar la campaña.
 * @property {any[]} joined Los que se vienen (ya del gremio).
 * @property {any[]} left Los que se quedan en su tierra.
 * @property {any[]} bench Los que se vienen pero no caben en el grupo: esperan en casa, en el gremio.
 * @property {string[]} lines
 */

/**
 * Al volver al gremio con la campaña terminada, cada compañero de esa tierra tiene su momento: si
 * quiere venirse (su vínculo, lo que le ata a su tierra), eliges tú; si no, se despide. Quien se
 * viene sigue en el grupo como del gremio; quien se queda sale de él. Se llama en el chat de la
 * campaña, antes de salir de él.
 *
 * @param {{campaign: string}} input La campaña que termina (`strahd`, `1387`…).
 * @returns {Promise<CampaignStays>}
 */
export async function settleCampaignCompanions({ campaign }) {
    /** @type {CampaignStays} */
    const out = { joined: [], left: [], bench: [], lines: [] };
    const id = String(campaign ?? '').trim();
    if (!chat_metadata || !id || combatEncounter.active) return out;
    const leaving = campaignCompanions(partyMembers, id);
    if (leaving.length === 0) return out;
    const cards = companionCards();
    const bonds = getCampaignBonds();
    /** @type {Record<string, 'viene'|'queda'>} */
    const choices = {};
    for (const member of leaving) {
        const verdict = stayVerdict({ member, rank: getBondProgress(bonds, String(member.id)).rank, cards });
        const scene = stayScene({ member, verdict, cards });
        const result = await openMeetupScene({
            scene,
            person: { name: String(member.name), className: String(member.className || member.class || member.charClass || ''), gender: String(member.gender || '') },
            pack: id,
            town: String(currentLocationName || ''),
            placeLabel: verdict.willing ? 'Al acabar la campaña' : 'La despedida',
            canLeave: false,
        });
        choices[String(member.id)] = result.finished ? stayChoice(scene, result.choices) : 'queda';
    }
    const land = String(hereLocation()?.region || '');
    const settled = settleStays({ party: partyMembers, bench: [], choices, campaign: id, land, day: campaignDay() });
    setPartyMembers(settled.party);
    savePartyState();
    renderPartyMembers();
    for (const line of settled.lines) {
        postCombatNarration(`🏠 [GRUPO] ${line}`);
        noteDeed(line);
    }
    // Se sale de este chat enseguida: con él guardado, que a medio guardar no deja cambiar de partida.
    await saveChatConditional();
    return { joined: settled.joined, left: settled.left, bench: settled.bench, lines: settled.lines };
}

/**
 * Y ya en el gremio: quien no cabía en el grupo espera en casa (se le llama desde el gremio), y
 * se dice quién es ya de los vuestros.
 *
 * @param {CampaignStays|null} stays
 */
export function welcomeGuildCompanions(stays) {
    if (!chat_metadata || !stays) return;
    if (stays.bench.length > 0) {
        chat_metadata[BENCH_KEY] = [...readBench(chat_metadata[BENCH_KEY]), ...stays.bench];
        saveMetadata();
    }
    const names = stays.joined.map(m => String(m.name));
    if (names.length > 0) {
        const line = names.length === 1 ? `${names[0]} ya es del gremio: vive en Puerto Alba y va con vosotros a lo que venga.`
            : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]} ya son del gremio: viven en Puerto Alba y van con vosotros a lo que venga.`;
        toastr.success(line, '🏠 El gremio crece', { timeOut: 10000 });
    }
    if (isShellOpen()) refreshGameShell();
}

/**
 * Al llegar a una campaña: quien es del gremio pero salió de esta tierra la reconoce (una frase,
 * sin más).
 *
 * @param {string} campaign
 */
export function sayHomecomings(campaign) {
    const id = String(campaign ?? '').trim();
    if (!id) return;
    for (const member of partyMembers.slice(1).filter(m => !m.dead)) {
        const line = homecomingLine(member, id, companionCards());
        if (line) postCombatNarration(`🏠 [GRUPO] ${line}`);
    }
}

