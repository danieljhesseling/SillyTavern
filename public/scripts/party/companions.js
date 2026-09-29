/**
 * Los compañeros: sus vínculos y escenas, lo que opinan, lo que dicen en combate, quién se
 * harta y se va, sus hazañas y apodos, los confidentes, los regalos y su tarjeta.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import {
    getCurrentWorldLocationMaps, getCurrentWorldEnemies, loadWorldInfo, saveWorldInfo, METADATA_KEY,
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
import { describeNeeds } from '../game-engine/rules/needs.js';
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
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { buildCompanionCard, judgeGift } from '../game-engine/ui/shell/companion-card.js';
import {
    APPROVAL_KEY, ATTITUDES_KEY, BENCH_KEY, BOARD_KEY, GONE_KEY, LEAVE_ON_KEY, MEMORIES_KEY, PERSONAL_ASKED_KEY,
    RECRUITS_MET_KEY, WARNED_KEY,
} from './keys.js';
import { combatEncounter, currentLocationName, partyMembers, setPartyMembers } from './state.js';
import { openOwnSheet } from './sheet.js';
import { canLevelUp, openLevelUpCard } from './level-up.js';
import { retireMember } from './hub.js';
import { lastConfidantEntries, lastWorldNpcs } from './world.js';
import {
    advanceCampaignSlot, campaignDay, getCampaignBonds, getCampaignCalendar, recordCampaignBondEvent,
} from './time.js';
import { noteDeed, refreshWorldMemoryPrompt, worldWrite } from './world-growth.js';
import { postCombatNarration, postForModel } from './narration.js';
import { getActivePartyLeader, memberFromEntry, partyPurse, renderPartyMembers, savePartyState } from './roster.js';
import { smithHere, smithPlaces, buyRemedy } from './town.js';

/**
 * R8: los favores de la gente de aquí que os aprecia (actitud +2 o más).
 *
 * @returns {ReturnType<typeof homeFavors>}
 */
export function favorsHere() {
    return homeFavors({ npcs: lastWorldNpcs, attitudes: readAttitudes(chat_metadata?.[ATTITUDES_KEY]), here: currentLocationName });
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
    if (friction) {
        postCombatNarration(`⚡ [GRUPO] ${friction.line}`);
        toastr.warning(friction.line, '⚡ Roce en el grupo', { timeOut: 9000 });
        void postForModel(`[ROCE] ${friction.line} Cuéntalo en una o dos frases: discuten, y nadie se va.`);
    }
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
    const due = duePersonalQuests({ party: partyMembers, rankOf: m => getBondProgress(bonds, String(m.id)).rank, asked });
    if (due.length === 0) return;
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
                recordCampaignBondEvent(String(member.id), 'shared_downtime');
                advanceCampaignSlot();
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
