/**
 * Los encargos: el tablón del gremio, aceptarlos, cumplirlos y cobrarlos; los que se mandan
 * sin el héroe, los mercenarios, los invitados y los rivales que se llevan el mejor.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import {
    getCurrentWorldLocationMaps, getCurrentWorldEnemies, loadWorldInfo, saveWorldInfo, METADATA_KEY,
} from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { busyFactions, saysWith } from '../game-engine/campaign/factions.js';
import { nextRandom } from './combat-rules.js';
import { terrainFromAsciiMap } from '../game-engine/board/terrain.js';
import { completeArc } from '../game-engine/campaign/companion-arcs.js';
import { whoReturns } from '../game-engine/campaign/nemesis.js';
import { generateIntended, threatOf, budgetFor } from '../game-engine/world-builder/board-intent.js';
import { namedContract, hasNamed, NAMED_CHANCE } from '../game-engine/campaign/named-contracts.js';
import { rivalOf, rivalsTake, describeRivalTake } from '../game-engine/campaign/rivals.js';
import { guestMember, hirelingsHere, guestsLeave, exitCell } from '../game-engine/campaign/guests.js';
import { withStairs, levelName } from '../game-engine/board/dungeon-levels.js';
import { applyInjury, rollInjury } from '../game-engine/rules/injuries.js';
import { lettersOf } from '../game-engine/rules/modes.js';
import { settlesDebt } from '../game-engine/campaign/patronage.js';
import {
    canDispatch, dispatchOdds, dispatchDays, startDispatch, dispatchesDue, resolveDispatch,
} from '../game-engine/campaign/dispatch.js';
import { readCases } from '../game-engine/campaign/cases.js';
import { actOf, hasEnded } from '../game-engine/campaign/plot.js';
import {
    availableWritten, writtenSlots, toBoardContract, describeWrittenAccept,
} from '../game-engine/campaign/written-contracts.js';
import {
    generateBoardOfContracts, contractsFromFactions, expireContracts, describeContract,
} from '../game-engine/campaign/contracts.js';
import { readGuild, boardSize, completeContract } from '../game-engine/campaign/guild.js';
import { generateBoard } from '../game-engine/world-builder/dungeon-generator.js';
import { formParty, readReasons } from '../game-engine/rules/companions.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    BOARD_KEY, CASES_KEY, DEBT_KEY, DISPATCHES_KEY, GUILD_KEY, NEMESES_KEY, PLOT_STATE_KEY, TAKEN_KEY,
    WRITTEN_DONE_KEY,
} from './keys.js';
import { currentBoardName, currentLocationName, partyMembers, setPartyMembers } from './state.js';
import {
    savePartyState, renderPartyMembers, enemiesInSeason, getCurrentWorldFactions, postCombatNarration,
    postForModel, currentSurvival, survivalNow, buryMember, settleFactionStake, campaignCompendium, lastBoardRules,
    lastWrittenQuests, lastWrittenContracts, lastMix, noteDeed, getPlot, notePlot, raiseFame, deliverRelics,
    countStat, shiftPlaceFortune, voiceOpinions, getDebt, getCampaignCalendar, getCampaignBonds, campaignDay,
    recordCampaignBondEvent, offerPersonalQuests, seedOfWorld, biomeHere, renderLocationMapsPreview,
} from './main.js';

/**
 * Entrega el encargo aceptado, si el combate que acaba de ganarse era el suyo.
 *
 * Aqui se cierra el bucle entero: el tablon te mando, el generador te construyo el sitio,
 * lo jugaste, y ahora te pagan y subes de reputacion — que es lo que abre el siguiente
 * rango del tablon. Sin esto, aceptar un encargo era apuntar una frase.
 */
export function deliverTakenContract() {
    const taken = chat_metadata?.[TAKEN_KEY];
    if (!taken || !currentBoardName) return;
    // Uno escrito se entrega en su tablero; uno generado, en el que se le construyo.
    const itsBoard = taken.boardName
        ? String(currentBoardName) === String(taken.boardName)
        : String(currentBoardName).includes('(encargo)');
    if (!itsBoard) return;
    finishTakenContract(taken);
}

/**
 * Cumplir el encargo aceptado: pagar, subir la reputacion, apuntarlo y contarlo.
 *
 * @param {any} taken
 */
export function finishTakenContract(taken) {
    const guild = getGuild();
    const done = completeContract(guild, taken);

    // El pago va al grupo, al mismo bolsillo del que sale la cena.
    const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
    if (holder) holder.gold = (Number(holder.gold) || 0) + done.gold;

    guild.renown = done.renown;
    chat_metadata[GUILD_KEY] = guild;
    delete chat_metadata[TAKEN_KEY];
    countStat('contracts');
    countStat('gold', Number(done.gold) || 0);

    noteDeed(`Entregasteis el encargo «${taken.title}»${taken.patron ? ` (lo pedía ${taken.patron})` : ''}.`);
    // Idea 85: al sitio le va mejor.
    void shiftPlaceFortune(String(taken.locationName ?? ''), 1);
    // Uno escrito no vuelve a salir, y su giro es lo que se descubre al cumplirlo.
    if (taken.written) {
        const done = Array.isArray(chat_metadata[WRITTEN_DONE_KEY]) ? chat_metadata[WRITTEN_DONE_KEY] : [];
        chat_metadata[WRITTEN_DONE_KEY] = [...new Set([...done, String(taken.id)])];
        if (taken.twist) {
            void postForModel(`[ENCARGO] «${taken.title}», cumplido. Lo que se descubre: ${taken.twist} `
                + 'Cuéntalo en un párrafo. No inventes nada que no esté aquí.');
        }
    }
    notePlot({ kind: 'contract', id: String(taken.id), faction: String(taken.faction || ''), against: Boolean(taken.against) });
    // Idea 52: donde se entrega, se sabe.
    raiseFame(String(taken.locationName ?? '') || currentLocationName);
    // Ideas 105 y 131: quien iba solo para este encargo, se va.
    dismissGuests(String(taken.id), 'cumplido');
    // Idea 30: el encargo de un compañero pesa el doble en su vínculo.
    if (taken.personal) {
        const friend = partyMembers.find(m => String(m.id) === String(taken.personal));
        if (friend) {
            recordCampaignBondEvent(String(friend.id), 'quest_together');
            recordCampaignBondEvent(String(friend.id), 'quest_together');
            toastr.success(`${friend.name} no lo olvida.`, '🤝 Encargo personal');
            // R8: su historia cambia lo que sabe hacer.
            const arc = completeArc(friend, readReasons(friend).wants);
            if (arc) {
                /** @type {any} */ (friend).perks = arc.perks;
                savePartyState();
                postCombatNarration(`🌱 [GRUPO] ${arc.line}`);
            }
            void postForModel(`[ENCARGO PERSONAL] ${friend.name} ve cumplido lo suyo: «${taken.title}». Que lo agradezca a su manera, en una o dos frases.`);
        }
    }
    // Idea 132: la reliquia de este encargo, si la tiene.
    const relicLines = deliverRelics({ kind: 'contract', id: String(taken.id) });
    if (relicLines.length > 0) {
        void postForModel(`[RELIQUIA] ${relicLines.join(' ')} Cuéntalo en una frase. No inventes nada que no esté aquí.`);
    }

    // Si era el favor que se debia, la cuenta queda saldada.
    const debt = getDebt();
    if (settlesDebt(debt, taken)) {
        delete chat_metadata[DEBT_KEY];
        const paid = `Favor cumplido: ${debt?.patronName} ${saysWith(debt?.patronName, 'da', 'dan')} la deuda por saldada.`;
        void postForModel(`🤝 [CAMPAÑA] ${paid}`);
        toastr.success(paid, 'Deuda saldada', { timeOut: 12000 });
    }
    saveMetadata();
    savePartyState();

    postCombatNarration(`🏆 [GREMIO] ${done.line}`);
    toastr.success(done.line, 'Encargo entregado', { timeOut: 12000 });

    // Y si el encargo tomaba partido, el mundo se entera: es lo que lo separa de un
    // recado. Va aparte porque escribir el mundo es asincrono y esto no puede serlo.
    if (taken.faction) void settleFactionStake(taken);
}

/** @returns {any} */
export function getGuild() {
    return readGuild(chat_metadata?.[GUILD_KEY]);
}

/**
 * Lo que el mundo dijo sobre su tablon, en el taller.
 *
 * Sin nada dicho, lo de siempre: uno de cada tres encargos de faccion y ninguna mision
 * escrita. Es la copia leida, porque esto se llama al dibujar y no puede esperar.
 *
 * @returns {{factionShare: number, theme: string, written: any[]}}
 */
function worldBoardRules() {
    return {
        factionShare: Number(lastBoardRules?.factionShare) || 3,
        theme: String(lastBoardRules?.theme ?? ''),
        written: Array.isArray(lastWrittenQuests) ? lastWrittenQuests : [],
    };
}

/**
 * U3 del pegamento: los encargos del tablón que caducan hoy, y el sitio que los pedía lo
 * nota. Lo llama el paso del tiempo cada día; antes solo pasaba al abrir el gremio.
 *
 * @param {number} today
 * @returns {any[]} Los que siguen.
 */
export function expireBoard(today) {
    if (!chat_metadata) return [];
    const { kept, expired } = expireContracts(chat_metadata[BOARD_KEY] ?? [], today);
    if (expired.length === 0) return kept;
    for (const gone of expired) {
        postCombatNarration(`📄 [GREMIO] Se paso el plazo: ${gone.title}.`);
        // Y al sitio que lo pedia, peor.
        void shiftPlaceFortune(String(gone.locationName ?? ''), -1);
    }
    chat_metadata[BOARD_KEY] = kept;
    saveMetadata();
    return kept;
}

/**
 * El tablon, llenandolo si hace falta.
 *
 * Los encargos vencen solos y el hueco se rellena: un tablon que se vacia deja de tirar
 * de ti, y uno que no vence deja de apretar.
 *
 * @returns {any[]}
 */
export function refreshContractBoard() {
    if (!chat_metadata) return [];

    const guild = getGuild();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const kept = expireBoard(today);

    const wanted = boardSize(guild);

    // Las que el mundo trae escritas salen una vez, al principio: son las que dan el tono.
    // Lo demas lo genera el tablon segun se va vaciando.
    const written = worldBoardRules().written;
    if (kept.length === 0 && written.length > 0) {
        kept.push(...written.filter((/** @type {any} */ q) => q.atStart !== false).map(
            (/** @type {any} */ quest, /** @type {number} */ i) => ({
                id: `w_${i}_${String(quest.title ?? '').slice(0, 12)}`,
                rank: 'D',
                kind: 'cull',
                title: String(quest.title ?? '').trim(),
                locationName: String(quest.where ?? '').trim(),
                reward: Math.max(0, Number(quest.reward) || 40),
                days: today + 14,
                difficulty: 0.25,
                patron: 'El mundo',
            }),
        ));
    }

    // Lo que trae escrito el mundo va primero, en la parte que le toca segun el acto: la
    // curva de la mezcla (M7). Lo demas lo pone el generador, como siempre.
    if (lastWrittenContracts.length > 0) {
        const plot = getPlot();
        const act = actOf(plot, chat_metadata[PLOT_STATE_KEY]);
        const taken = chat_metadata?.[TAKEN_KEY];
        const pool = availableWritten({
            contracts: lastWrittenContracts,
            act,
            done: Array.isArray(chat_metadata[WRITTEN_DONE_KEY]) ? chat_metadata[WRITTEN_DONE_KEY] : [],
            busy: [...kept.map((/** @type {any} */ c) => String(c.id)), taken ? String(taken.id) : ''],
        });
        const slots = writtenSlots({
            wanted,
            onBoard: kept.filter((/** @type {any} */ c) => c.written).length,
            available: pool.length,
            act,
            ended: plot ? hasEnded(plot, chat_metadata[PLOT_STATE_KEY]) : false,
            mix: lastMix,
        });
        // Sin pasarse del tamano del tablon: lo escrito entra en los huecos, no encima.
        kept.push(...pool.slice(0, Math.min(slots, Math.max(0, wanted - kept.length))).map(w => toBoardContract(w, today)));
    }

    // Uno de cada N encargos sale de lo que alguien quiere de verdad. Lo dice el mundo, y
    // por defecto uno de cada tres: un tablon que solo habla de facciones deja de ofrecer
    // trabajo y pasa a ser una guerra.
    const share = Math.max(1, Number(worldBoardRules().factionShare) || 3);
    const huecos = wanted - kept.length;
    if (huecos > 0) {
        const suyos = contractsFromFactions({
            factions: busyFactions(getCurrentWorldFactions())
                // Los que ya estan en el tablon no se repiten: un encargo por faccion.
                .filter((/** @type {any} */ f) => !kept.some((/** @type {any} */ c) => c.faction === f.id)),
            random: nextRandom,
            renown: guild.renown,
            day: today,
            count: Math.max(0, Math.floor(huecos / share)),
        });
        kept.push(...suyos);
    }

    // Idea 116: uno te nombra, por tu trasfondo. Uno a la vez, y en el hueco de uno
    // generado: el tablón no crece, y lo escrito sigue siendo la mayoría.
    const places116 = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name || '')).filter(Boolean);
    const bestiary116 = enemiesInSeason().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);
    if (kept.length < wanted && !hasNamed(kept) && nextRandom() < NAMED_CHANCE.chance) {
        const named = namedContract({ hero: partyMembers[0], places: places116, bestiary: bestiary116, random: nextRandom, day: today });
        if (named) kept.push(named);
    }
    if (kept.length < wanted) {
        const fresh = generateBoardOfContracts({
            random: nextRandom,
            count: wanted - kept.length,
            renown: guild.renown,
            theme: guild.theme,
            day: today,
            places: places116,
            // Idea 97: los que migran solo salen en su estación.
            bestiary: bestiary116,
        });
        kept.push(...fresh);
    }

    chat_metadata[BOARD_KEY] = kept;
    saveMetadata();
    // Idea 30: y lo que pidan los tuyos, si ya toca.
    offerPersonalQuests();
    return /** @type {any[]} */ (chat_metadata[BOARD_KEY]);
}

/**
 * U8: mandar a uno o dos compañeros, sin el héroe, a un encargo menor del tablón. La
 * probabilidad se ve antes de mandarlos; mientras están fuera, no van con el grupo.
 *
 * @param {any} contract
 * @returns {Promise<boolean>}
 */
export async function openDispatch(contract) {
    if (!chat_metadata) return false;
    const allowed = canDispatch(contract);
    if (!allowed.ok) {
        toastr.info(allowed.reason, 'Despachar');
        return false;
    }
    const hero = partyMembers[0];
    const candidates = partyMembers.filter(m => m !== hero && !m.dead && (Number(m.hp) || 0) > 0 && !m.guest);
    if (candidates.length === 0) {
        toastr.info('No hay nadie a quien mandar: el héroe no se despacha.', 'Despachar');
        return false;
    }
    const body = $('<div class="dp-root"></div>');
    body.append($('<h3></h3>').text(`Mandar a «${contract.title}»`));
    body.append($('<p class="dp-intro"></p>').text('Uno o dos, sin el héroe. Mientras estén fuera, no van con vosotros.'));
    for (const member of candidates) {
        const box = $('<input type="checkbox" class="dp-pick">').attr('value', String(member.id));
        body.append($('<label class="dp-member"></label>').append(box).append(document.createTextNode(` ${member.name} (nivel ${Number(member.level) || 1})`)));
    }
    const odds = $('<p class="dp-odds"></p>');
    body.append(odds);
    const chosen = () => candidates.filter(m => body.find(`.dp-pick[value="${String(m.id)}"]`).prop('checked')).slice(0, 2);
    const update = () => {
        const members = chosen();
        if (members.length === 0) {
            odds.text('Elige a quién mandas.');
            return;
        }
        const guess = dispatchOdds({ members, contract });
        odds.text(`${Math.round(guess.chance * 100)} % de que salga bien · de vuelta en ${dispatchDays(contract)} días.${guess.reasons.length > 0 ? ` ${guess.reasons.join('. ')}.` : ''}`);
    };
    body.on('change', '.dp-pick', function () {
        // Dos como mucho: el tercero que se marca desmarca el primero.
        if (body.find('.dp-pick:checked').length > 2) $(this).prop('checked', false);
        update();
    });
    update();
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Mandarlos', cancelButton: 'Mejor no' }).show();
    const members = chosen();
    if (!ok || members.length === 0) return false;
    const { chance } = dispatchOdds({ members, contract });
    const dispatch = startDispatch({ contract, members, today: Math.max(1, campaignDay()), chance });
    chat_metadata[DISPATCHES_KEY] = [...(Array.isArray(chat_metadata[DISPATCHES_KEY]) ? chat_metadata[DISPATCHES_KEY] : []), dispatch];
    chat_metadata[BOARD_KEY] = (Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : []).filter((/** @type {any} */ c) => String(c?.id) !== String(contract.id));
    // En el sitio: `partyMembers` es el array que el resto del archivo tiene cogido.
    for (const member of members) {
        const at = partyMembers.indexOf(member);
        if (at >= 0) partyMembers.splice(at, 1);
    }
    savePartyState();
    renderPartyMembers();
    saveMetadata();
    const names = members.map(m => String(m.name)).join(' y ');
    postCombatNarration(`🧭 [GREMIO] ${names} ${members.length > 1 ? 'salen' : 'sale'} hacia «${contract.title}»: ${Math.round(chance * 100)} % de que salga bien, de vuelta en ${dispatchDays(contract)} días.`);
    if (isShellOpen()) refreshGameShell();
    return true;
}

/**
 * U8: vuelven los que mandasteis, con lo que traigan. Si sale, se cobra y el sitio lo nota;
 * si sale mal, heridos, y si la campaña lo permite y sale muy mal, alguno no vuelve.
 *
 * @param {number} today
 */
export function returnDispatches(today) {
    if (!chat_metadata) return;
    const { due, away } = dispatchesDue(chat_metadata[DISPATCHES_KEY], today);
    if (due.length === 0) return;
    chat_metadata[DISPATCHES_KEY] = away;
    const seed = String(chat_metadata?.[METADATA_KEY] || '');
    const survival = currentSurvival();
    for (const dispatch of due) {
        const random = createSeededRandom(derive(seed, 'despacho', dispatch.id));
        const result = resolveDispatch({ dispatch, random, allowDeath: survival.mortality === 'everyone' });
        for (const member of dispatch.members) {
            if (String(member.id) === result.dead) {
                member.dead = true;
                member.hp = 0;
                countStat('deaths');
                buryMember(member, today, getCampaignBonds());
            } else if (String(member.id) === result.hurt && survival.injuries) {
                const patch = applyInjury(member, rollInjury(() => random() * 0.4));
                member.injuries = patch.injuries;
                member.baseStats = patch.baseStats;
                Object.assign(member, patch.stats);
            }
            partyMembers.push(member);
        }
        if (result.success) finishDispatchedContract(dispatch.contract);
        else void shiftPlaceFortune(String(dispatch.contract?.locationName ?? ''), -1);
        postCombatNarration(`🧭 [GREMIO] ${result.line}`);
        noteDeed(result.line);
    }
    savePartyState();
    renderPartyMembers();
    saveMetadata();
    if (isShellOpen()) refreshGameShell();
}

/**
 * U8: un encargo cumplido sin el héroe: se cobra, sube la reputación y el sitio lo nota.
 *
 * @param {any} contract
 */
function finishDispatchedContract(contract) {
    const guild = getGuild();
    const done = completeContract(guild, contract);
    const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
    if (holder) holder.gold = (Number(holder.gold) || 0) + done.gold;
    guild.renown = done.renown;
    chat_metadata[GUILD_KEY] = guild;
    countStat('contracts');
    countStat('gold', Number(done.gold) || 0);
    void shiftPlaceFortune(String(contract?.locationName ?? ''), 1);
}

/**
 * Idea 94: la compañía rival de este mundo, siempre la misma.
 *
 * @returns {{name: string, leader: string}}
 */
function currentRival() {
    return rivalOf(createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'rivales')));
}

/**
 * Idea 94: cada semana, los rivales se llevan el mejor encargo generado del tablón.
 */
export function rivalsMove() {
    if (!chat_metadata || !chat_metadata[METADATA_KEY]) return;
    const { taken, board } = rivalsTake(chat_metadata[BOARD_KEY]);
    if (!taken) return;
    chat_metadata[BOARD_KEY] = board;
    saveMetadata();
    const line = describeRivalTake(currentRival(), taken);
    postCombatNarration(`⚔️ [GREMIO] ${line}`);
    toastr.info(line, 'Los rivales', { timeOut: 9000 });
    void postForModel(`[RIVALES] ${line} Cuéntalo como algo que se comenta en el gremio, en una frase.`);
}

/**
 * Ideas 105 y 131: los invitados de un encargo se van al acabarlo.
 *
 * @param {string} contractId
 * @param {'cumplido'|'perdido'} how
 */
export function dismissGuests(contractId, how) {
    const { leaving, party } = guestsLeave(partyMembers, contractId);
    if (leaving.length === 0) return;
    setPartyMembers(party);
    for (const guest of leaving) {
        const line = guest.guest?.kind === 'mercenary'
            ? `${guest.name} cobró por este encargo${how === 'cumplido' ? ' y se despide' : ', y se va sin mirar atrás'}.`
            : `${guest.name} ${how === 'cumplido' ? 'llega a su sitio y se despide' : 'no llegará a ninguna parte'}.`;
        postCombatNarration(`🧳 [GREMIO] ${line}`);
    }
    savePartyState();
    renderPartyMembers();
}

/**
 * Idea 131: pagar a alguien para el encargo de ahora.
 *
 * @param {string} name
 */
export function hireMercenary(name) {
    const taken = chat_metadata?.[TAKEN_KEY];
    const offer = hirelingsHere(createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mercenario', currentLocationName, String(campaignDay()))), Number(partyMembers[0]?.level) || 1)
        .find(o => o.name === name);
    if (!taken || !offer) return;
    const merc = guestMember({
        id: Date.now(), name: offer.name, kind: 'mercenary', contractId: String(taken.id), level: Number(partyMembers[0]?.level) || 1,
        base: partyMembers[0], stats: offer,
    });
    merc.mapPosition = { ...(partyMembers[0]?.mapPosition ?? { locationName: currentLocationName, gridX: 1, gridY: 1 }) };
    partyMembers.push(merc);
    savePartyState();
    renderPartyMembers();
    const line = `${merc.name} se apunta para «${taken.title}»: cobra ${offer.fee} de oro y se va al acabar.`;
    postCombatNarration(`🗡️ [POSADA] ${line}`);
    toastr.success(line, 'Mercenario');
}

/**
 * Acepta un encargo y le construye el sitio donde se juega.
 *
 * Aqui se juntan las dos mitades del plan: el tablon dice **que** hay que hacer y el
 * generador construye **donde**. Sin esto, aceptar un encargo seria apuntar una frase.
 *
 * @param {string} id
 * @returns {Promise<string>}
 */
export async function acceptContract(id) {
    const board = chat_metadata?.[BOARD_KEY] ?? [];
    const contract = board.find((/** @type {any} */ c) => String(c?.id) === String(id));
    if (!contract) return '';

    // Uno escrito ya tiene su sitio: el tablero del guion, o ninguno si se resuelve sin
    // pelear. No se genera nada.
    if (contract.written) {
        chat_metadata[TAKEN_KEY] = contract;
        chat_metadata[BOARD_KEY] = board.filter((/** @type {any} */ c) => String(c?.id) !== String(id));
        saveMetadata();
        const said = describeWrittenAccept(contract);
        postCombatNarration(`📄 [GREMIO] ${said}`);
        void postForModel(`[ENCARGO] ${said} Cuéntalo en una o dos frases. No inventes nada que no esté aquí.`);
        const formedWritten = formParty(partyMembers, contract, { max: Math.max(1, partyMembers.length) });
        for (const line of formedWritten.lines) postCombatNarration(`🫱 [GREMIO] ${line}`);
        voiceOpinions(contract);
        toastr.success(contract.locationName, 'Encargo aceptado');
        return said;
    }

    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = await loadWorldInfo(worldName);
    if (!data) return '';

    // Idea 97: los que migran solo salen en su estación.
    const bestiary = enemiesInSeason()
        .map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);

    // De que clase es el sitio, de que esta hecho por dentro y en que estado esta. Sin
    // bateria de sitios sale lo de siempre: salas y pasillos, como hasta ahora.
    const compendium = await campaignCompendium();
    const seed = derive(seedOfWorld(data.metadata), 'encargo', String(contract.id));
    const random = createSeededRandom(seed);
    const biome = biomeHere(data.metadata);

    const type = compendium.has('sitios')
        ? compendium.pick('sitios', { where: { kind: 'tipo', biome }, random })
            ?? compendium.pick('sitios', { where: { kind: 'tipo' }, random })
        : null;
    const state = compendium.has('sitios')
        ? compendium.pick('sitios', { where: { kind: 'estado' }, random })
        : null;
    // R6: las salas escritas, las de siempre y las pensadas para este propósito.
    const templates = compendium.has('sitios')
        ? compendium.find('sitios', { kind: 'sala' })
            .filter((/** @type {any} */ row) => !Array.isArray(row.when?.purpose) || row.when.purpose.includes(String(contract.kind || '')))
            .map((/** @type {any} */ row) => row.rows)
        : [];

    // R6: el sitio sabe para qué es. El propósito del encargo manda en la forma, el sitio en
    // lo que trae (y en sus trampas), y los enemigos salen por presupuesto (idea 83): por el
    // nivel y el tamaño del grupo, el encargo y el modo. Si no sale divertido, se vuelve a
    // tirar con la semilla siguiente.
    const heroLevels = partyMembers.filter(m => !m.dead && !m.guest).map(m => Number(m.level) || 1);
    const generated = generateIntended({
        // El dado del mundo, no el de la sesion: el mismo encargo da el mismo sitio.
        randomFor: (attempt) => (attempt === 0 ? random
            : createSeededRandom(derive(seedOfWorld(data.metadata), 'encargo', String(contract.id), 'intento', String(attempt)))),
        generate: generateBoard,
        purpose: String(contract.kind || 'cull'),
        site: `${String(type?.name ?? '')} ${biome}`,
        options: enemiesInSeason().map((/** @type {any} */ e) => ({ name: String(e?.name || ''), threat: threatOf(e) })).filter(o => o.name),
        budget: budgetFor({
            partyLevel: heroLevels.length > 0 ? Math.round(heroLevels.reduce((a, b) => a + b, 0) / heroLevels.length) : 1,
            partySize: Math.max(1, heroLevels.length),
            difficulty: Number(contract.difficulty) || 1,
            letters: lettersOf(survivalNow()),
        }),
        board: {
            size: contract.difficulty >= 5 ? 'large' : (contract.difficulty >= 1 ? 'medium' : 'small'),
            shape: String(type?.shape || 'rooms'),
            templates,
            state: state ? { cover: state.cover, rough: state.rough } : null,
            partySize: Math.max(1, partyMembers.length),
        },
    });

    // El sitio entra como una localidad de verdad, editable en `/campana` y exportable con
    // la campana. Lo generado que no se guarda como contenido de primera clase es texto
    // suelto: no hay mapa que aprender ni sitio al que volver.
    const places = Array.isArray(data.metadata?.locationMaps) ? data.metadata.locationMaps : [];
    const placeName = contract.locationName || contract.title;
    let place = places.find((/** @type {any} */ l) => String(l?.name) === placeName);
    if (!place) {
        place = { name: placeName, description: '', url: '', gridWidth: 50, gridHeight: 50, boards: [] };
        places.push(place);
    }
    place.boards = Array.isArray(place.boards) ? place.boards : [];

    const boardName = `${contract.title} (encargo)`;
    const built = {
        name: boardName,
        description: [
            `Encargo de rango ${contract.rank} para ${contract.patron}.`,
            // Lo que el sitio es y como esta, escrito donde el narrador lo lee.
            type ? `${type.name}: ${type.note}` : '',
            state ? `${state.name}. ${state.note}` : '',
        ].filter(Boolean).join(' '),
        url: '',
        gridWidth: generated.gridWidth,
        gridHeight: generated.gridHeight,
        terrain: terrainFromAsciiMap(generated.map),
        partyStart: generated.partyStart,
        enemyPlacements: generated.enemies,
        objectives: /** @type {any[]} */ ([]),
        // R6: las trampas del sitio, cada una con su aviso, y los refuerzos que llegan.
        hazards: generated.hazards ?? [],
        waves: generated.waves ?? [],
    };
    // R6: si hay un caso abierto con algo que registrar en este sitio, la pista está en el
    // tablero: en la sala del fondo, a la vista para quien la pise.
    const openCase = readCases(chat_metadata?.[CASES_KEY]);
    const toFind = openCase.active?.clues.find(c => c.how === 'registrar' && c.source.kind === 'sitio'
        && String(c.source.name).toLowerCase() === String(placeName).toLowerCase() && !openCase.found.includes(c.id));
    const clueCell = toFind ? (generated.target ?? built.enemyPlacements[built.enemyPlacements.length - 1] ?? null) : null;
    if (toFind && clueCell) {
        built.hazards = [...built.hazards, {
            id: `pista-${toFind.id}`, name: 'Algo que no encaja', kind: 'pista', trigger: 'enter', effect: 'none',
            x: clueCell.x, y: clueCell.y, tell: 'Algo que no encaja con el resto.', note: `caso:${toFind.id}`, seen: true, armed: true, once: true,
        }];
    }
    // R7: si toca, la némesis vuelve: en el sitio del más fuerte, si es de este mundo.
    const nemesis = whoReturns({ raw: chat_metadata?.[NEMESES_KEY], today: campaignDay(), random });
    if (nemesis && getCurrentWorldEnemies().some((/** @type {any} */ e) => String(e.name) === nemesis.name) && built.enemyPlacements.length > 0) {
        built.enemyPlacements = [{ ...built.enemyPlacements[0], name: nemesis.name, nemesis: nemesis.id }, ...built.enemyPlacements.slice(1)];
    }
    // R6: lo que se busca, en la sala más lejana (y en un robo, detrás de una puerta con llave).
    if (generated.target && (contract.kind === 'recover' || contract.kind === 'steal')) {
        built.objectives = [{
            id: 'recuperar', type: 'reach_cell', cell: generated.target,
            label: `Llegar a lo que se busca, en (${generated.target.x + 1}, ${generated.target.y + 1})`,
        }];
    }
    // Idea 105: a quien se escolta, en el tablero, y la salida adonde hay que llevarlo.
    const start = generated.partyStart?.[0] ?? { x: 1, y: 1 };
    const ward = contract.kind === 'escort'
        ? guestMember({ id: Date.now(), name: String(contract.patron || 'El viajero'), kind: 'ward', contractId: String(contract.id), level: Number(partyMembers[0]?.level) || 1, base: partyMembers[0] })
        : null;
    const exit = ward ? exitCell(generated.map, start) : null;
    if (ward && exit) {
        built.objectives = [{ id: 'escoltar', type: 'escort', allyId: String(ward.id), cell: exit, label: `Llevar a ${ward.name} hasta la salida (${exit.x + 1}, ${exit.y + 1}), vivo` }];
    }
    /** @type {any[]} */
    const levels = [built];
    // Idea 75: los grandes tienen dos niveles, con una escalera al fondo del primero.
    if ((Number(contract.difficulty) || 0) >= 3) {
        const deeper = generateBoard({
            random: createSeededRandom(derive(seedOfWorld(data.metadata), 'encargo', String(contract.id), 'nivel2')),
            size: 'medium',
            shape: String(type?.shape || 'rooms'),
            templates,
            state: state ? { cover: state.cover, rough: state.rough } : null,
            bestiary,
            partySize: Math.max(1, partyMembers.length),
        });
        const below = levelName(boardName);
        built.terrain = terrainFromAsciiMap(withStairs(generated.map, start));
        /** @type {any} */ (built).next = below;
        levels.push({
            name: below, description: 'Más abajo.', url: '', gridWidth: deeper.gridWidth, gridHeight: deeper.gridHeight,
            terrain: terrainFromAsciiMap(deeper.map), partyStart: deeper.partyStart, enemyPlacements: deeper.enemies, objectives: [],
        });
    }
    place.boards = [...place.boards.filter((/** @type {any} */ b) => !levels.some(l => l.name === b?.name)), ...levels];
    if (ward) {
        ward.mapPosition = { locationName: placeName, gridX: Number(start.x) || 1, gridY: Number(start.y) || 1 };
        partyMembers.push(ward);
        savePartyState();
        renderPartyMembers();
        postCombatNarration(`🧳 [GREMIO] ${ward.name} va con vosotros: hay que llevarle vivo hasta la salida.`);
    }

    data.metadata = Object.assign(data.metadata ?? {}, { locationMaps: places });
    await saveWorldInfo(worldName, data, true);

    chat_metadata[TAKEN_KEY] = contract;
    chat_metadata[BOARD_KEY] = board.filter((/** @type {any} */ c) => String(c?.id) !== String(id));
    saveMetadata();

    const line = `Aceptado: ${describeContract(contract, Number(getCampaignCalendar()?.day) || 1)}`;
    postCombatNarration(`📄 [GREMIO] ${line}`);
    postCombatNarration(`🗺️ [GREMIO] El sitio ya existe: ${placeName} — ${boardName}.`);

    // Y quien va. Cada uno con su motivo, tambien los que se quedan: un "no" que no se
    // entiende no es una decision, es un error. Es la diferencia entre un compañero y una
    // ficha que a veces falta.
    const formed = formParty(partyMembers, contract, { max: Math.max(1, partyMembers.length) });
    for (const said of formed.lines) postCombatNarration(`🫱 [GREMIO] ${said}`);
    if (formed.going.length === 0) {
        toastr.warning('Nadie quiere ir a este. Mira sus motivos en el registro.', 'Sin grupo');
    }
    voiceOpinions(contract);
    toastr.success(`${placeName} — ${boardName}`, 'Encargo aceptado');
    renderLocationMapsPreview();
    return line;
}
