/**
 * Hablar y escribir: con quién se habla, qué se hace con lo que se escribe en la caja (el
 * motor o el modelo), las tiradas de habilidad, examinar, sonsacar y lo que ofrece el narrador.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata, sendMessageAsUser } from '../../script.js';
import { getCurrentWorldLocationMaps, loadWorldInfo, saveWorldInfo, METADATA_KEY } from '../world-info.js';
import { addItemToInventory, createItem } from '../dnd-system.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { rollDiceDetailed } from './combat-rules.js';
import {
    canPry, notePry, secretNote, readSecrets, SECRET_DC, SECRET_SKILL,
} from '../game-engine/campaign/npc-secrets.js';
import { repliesFor } from '../game-engine/ui/shell/replies.js';
import { languageBarrier, SOCIAL_SKILLS } from '../game-engine/rules/languages.js';
import { addOffer, takeOffer, resolveOffer } from '../game-engine/campaign/item-offers.js';
import { shiftAttitude, attitudeBonus, describeAttitude } from '../game-engine/campaign/attitudes.js';
import { relieve } from '../game-engine/rules/needs.js';
import { SKILLS, rollCheck, skillModifier, DEFAULT_DC } from '../game-engine/rules/checks.js';
import {
    talkTopics, topicAnswer, threatAnswer, talkNote, talkPromptNote, sceneAddressee, effectiveAttitude, confronts,
} from '../game-engine/campaign/talk.js';
import { takeRequest } from '../game-engine/campaign/check-requests.js';
import { readCases, cluesHere } from '../game-engine/campaign/cases.js';
import { settlesNoFight } from '../game-engine/campaign/written-contracts.js';
import { servicesOf } from '../game-engine/campaign/services.js';
import { readBox, boxExamples, explainMiss } from '../game-engine/campaign/read-box.js';
import { outcomeOf as checkOutcome, consequence } from '../game-engine/campaign/consequences.js';
import { describeLootItem, declaredLootNames } from '../game-engine/combat/loot-items.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    ATTITUDES_KEY, CASES_KEY, CHECK_REQUESTS_KEY, FIELD_GAINS_KEY, OFFERS_KEY, PENDING_CHECK_KEY, RUMORS_HEARD_KEY,
    SECRETS_KEY, TAKEN_KEY,
} from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, narratorTurn, partyMembers, setNarratorTurn,
    setTalkingTo, talkingTo, worldItemCatalogue,
} from './state.js';
import { finishTakenContract } from './contracts.js';
import { askAboutCase, canDuel, revealClue } from './cases.js';
import { getAliveEnemies, waitingHere } from './combat-state.js';
import { showCombatDiceRoll } from './combat-log.js';
import { endPlayerCombatTurn, handlePlayerCombatAttack, handlePlayerCombatMove } from './player-actions.js';
import { renderLocationMapsPreview } from './board-view.js';
import {
    ensureWorldData, getLocationBoards, hereLocation, lastCompendium, lastRumors, lastWorldNpcs, worldNpc,
} from './world.js';
import { advanceCampaignSlot, campaignDay, getCampaignCalendar, getCurrentSlotLabel } from './time.js';
import { notePlot, openMilestones } from './plot.js';
import { noteDeed, refreshWorldMemoryPrompt, worldWrite } from './world-growth.js';
import {
    modelNarrates, narratorMode, noteRollInWindow, postCombatNarration, postForModel, showTip, tellMoment,
} from './narration.js';
import { payFromParty, savePartyState } from './roster.js';
import { changeAttitude } from './companions.js';
import { neighbourPlaces, askBeforeTravelling, travelWithTime } from './travel.js';
import { hearRumor, openService, buildServiceCards, runService, rumorsLeftHere } from './town.js';
import { openJournalSafely, openHelp } from './menus.js';

/**
 * @returns {{day: number, keys: string[], looked: string[]}}
 */
function fieldGainsToday() {
    const today = campaignDay();
    const stored = chat_metadata?.[FIELD_GAINS_KEY];
    if (!stored || Number(stored.day) !== today) return { day: today, keys: [], looked: [] };
    return {
        day: today,
        keys: Array.isArray(stored.keys) ? stored.keys.map(String) : [],
        looked: Array.isArray(stored.looked) ? stored.looked.map(String) : [],
    };
}

/** El botón «Al narrador» está puesto: lo próximo que se escriba es para él (2026-09-28). */
export let askingNarrator = false;

/**
 * Idea 139: apuntar lo que ofrece el narrador, para que quien juega lo coja si quiere.
 *
 * @param {any} name
 * @param {any} note
 * @param {any} to
 * @returns {string}
 */
export function offerItem(name, note, to) {
    if (!chat_metadata) return 'No hay partida.';
    const result = addOffer(chat_metadata[OFFERS_KEY], { name: String(name ?? ''), note: String(note ?? ''), to: String(to ?? '') }, { day: campaignDay() });
    if (!result.added) return `No se ofrece: ${result.reason}`;
    chat_metadata[OFFERS_KEY] = result.offers;
    saveMetadata();
    if (isShellOpen()) refreshGameShell();
    return 'Ofrecido. El jugador lo verá como opción; no narres que ya lo lleva.';
}

/**
 * Idea 139: coger lo que ofreció el narrador. Entra lo que el motor conoce, y si es mágico
 * o no lo conoce, una curiosidad que no hace nada.
 *
 * @param {string} idOrName
 * @returns {string}
 */
export function acceptOffer(idOrName) {
    if (!chat_metadata) return '';
    const { offer, offers } = takeOffer(chat_metadata[OFFERS_KEY], idOrName);
    if (!offer) {
        toastr.info('No hay nada así esperando.', 'Coger');
        return '';
    }
    const catalogue = [...worldItemCatalogue, ...declaredLootNames().map(name => describeLootItem(name))];
    const { item, known } = resolveOffer(offer, catalogue);
    const holder = partyMembers.find(m => !m.dead && String(m.name).toLowerCase() === offer.to.toLowerCase())
        ?? partyMembers.find(m => !m.dead) ?? partyMembers[0];
    if (!holder) return '';
    const spec = known ? describeLootItem(String(item.name), String(item.rarity ?? ''), worldItemCatalogue) : item;
    addItemToInventory(/** @type {any} */ (holder), createItem(/** @type {any} */ (spec)));
    chat_metadata[OFFERS_KEY] = offers;
    saveMetadata();
    savePartyState();
    const line = `${holder.name} coge ${offer.name}${known ? '' : ' (una curiosidad: no hace nada que el juego sepa)'}.`;
    postCombatNarration(`🎁 [CAMPAÑA] ${line}`);
    toastr.success(line, 'Coger');
    if (isShellOpen()) refreshGameShell();
    return line;
}

/**
 * Con quién se está hablando ahora, si es alguien que puede contestar: alguien de aquí o de
 * tu grupo, y sin pelea en marcha.
 *
 * @returns {{name: string, npc: any|null}|null}
 */
export function speakingWith() {
    const who = String(talkingTo || '').trim();
    if (!who || combatEncounter.active) return null;
    const npc = lastWorldNpcs.find(n => !n.dead && n.name === who && n.where.toLowerCase() === String(currentLocationName).toLowerCase()) ?? null;
    if (npc) return { name: npc.name, npc };
    const friend = partyMembers.slice(1).find(m => !m.dead && String(m.name) === who);
    return friend ? { name: String(friend.name), npc: null } : null;
}

/**
 * Qué se hace con lo que se escribe en la caja (Daniel, 2026-09-28: «el narrador ha de narrar
 * en momentos más importantes», y con el alguacil delante «¿qué pasa?» lo contestaba él).
 *
 * - Con el botón «Al narrador» puesto, va al narrador, fuera de la escena, y contesta él.
 * - Lo que el motor entiende (ir, entrar, descansar…) lo hace el motor, como antes.
 * - Lo demás va al modelo, y **contesta quien tienes delante**: a quien nombras, si está aquí,
 *   o quien te está plantando cara en el tablero. Desde ahí se está hablando con esa persona
 *   (sus respuestas sugeridas y «Despedirse»), hasta despedirse, irse o empezar la pelea.
 * - Si no hay nadie delante, contesta el narrador contando qué pasa.
 *
 * Una sola llamada por mensaje: cambia el estado del turno.
 *
 * @param {string} said
 * @returns {'engine'|'model'}
 */
export function routeTyped(said) {
    setNarratorTurn(askingNarrator);
    askingNarrator = false;
    showNarratorAsk();
    if (narratorTurn) return 'model';
    if (engineTakesBox(said)) return 'engine';
    if (!chat_metadata?.[METADATA_KEY] || speakingWith() || combatEncounter.active) return 'model';
    const intent = readBox(said, boxContext());
    if (intent.do !== 'unknown' && !(intent.do === 'check' && SOCIAL_SKILLS.includes(String(intent.skill)))) return 'model';
    const who = sceneAddressee({
        said,
        people: lastWorldNpcs.filter(n => !n.dead && n.where.toLowerCase() === String(currentLocationName).toLowerCase()).map(n => n.name),
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => String(m.name)),
        waiting: waitingHere(),
    });
    if (who) {
        setTalkingTo(who);
        notePlot({ kind: 'talk', npc: who });
        if (isShellOpen()) refreshGameShell();
    }
    return 'model';
}

/**
 * Z3 y Z6: si lo escrito lo hace el motor. Sin modelo, todo; en «Mixto», lo que la caja
 * entiende, salvo hablando con alguien o convenciéndole con tus palabras.
 *
 * @param {string} said
 * @returns {boolean}
 */
function engineTakesBox(said) {
    if (!chat_metadata?.[METADATA_KEY]) return false;
    const mode = narratorMode();
    if (mode === 'motor') return true;
    if (mode !== 'mixto' || speakingWith()) return false;
    const intent = readBox(said, boxContext());
    return intent.do !== 'unknown' && !(intent.do === 'check' && SOCIAL_SKILLS.includes(String(intent.skill)));
}

/**
 * El botón «Al narrador»: lo próximo que escribas es para él. Sin modelo no hay a quién
 * preguntar, así que abre lo mismo que «¿Qué hago?». Pulsarlo otra vez lo quita.
 *
 * @returns {void}
 */
export function askNarrator() {
    if (narratorMode() === 'motor') {
        void openHelp();
        return;
    }
    askingNarrator = !askingNarrator;
    showNarratorAsk();
    const box = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    box?.focus();
}

/**
 * Que se note que lo próximo va al narrador: la caja lo dice, y el botón queda encendido.
 *
 * @returns {void}
 */
function showNarratorAsk() {
    const box = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    if (box) {
        if (askingNarrator && !box.dataset.placeholderBefore) box.dataset.placeholderBefore = box.placeholder;
        box.placeholder = askingNarrator ? 'Pregúntale al narrador, fuera de la escena…' : (box.dataset.placeholderBefore || box.placeholder);
        if (!askingNarrator) delete box.dataset.placeholderBefore;
        box.classList.toggle('gs-asking-narrator', askingNarrator);
    }
    document.querySelectorAll('#game-shell .gs-chip-narrator').forEach(b => b.classList.toggle('on', askingNarrator));
}

/**
 * Para el modelo: a quién le habla quien juega, con su oficio, su voz y cómo os mira.
 *
 * @returns {string}
 */
export function speakingNote() {
    const with_ = speakingWith();
    if (!with_) return '';
    if (!with_.npc) return talkPromptNote({ name: with_.name, companion: true });
    return talkPromptNote({
        name: with_.name, trade: String(with_.npc.trade ?? ''), voice: String(with_.npc.voice ?? ''),
        attitudeWord: describeAttitude(attitudeTowards(with_.name)), confronting: confrontingNow(with_.name),
    });
}

/**
 * Si alguien os está plantando cara ahora: está entre los que esperan en el tablero para
 * pelear (el alguacil Torres, con sus guardias en la posada).
 *
 * @param {string} name
 * @returns {boolean}
 */
function confrontingNow(name) {
    return confronts(name, waitingHere());
}

/**
 * Cómo os mira alguien ahora mismo: lo apuntado, salvo que os esté plantando cara, que
 * entonces como mucho receloso (Daniel, 2026-09-28: Torres salía «neutral» reventando la puerta).
 *
 * @param {string} name
 * @returns {number}
 */
function attitudeTowards(name) {
    return effectiveAttitude(attitudeBonus(chat_metadata?.[ATTITUDES_KEY], name), confrontingNow(name));
}

/**
 * A quien nombra lo ultimo que se ha narrado.
 *
 * No crea a nadie: solo sirve para poner delante al companero del que se estaba hablando.
 *
 * @returns {string[]}
 */
export function namesInLastNarration() {
    const last = [...(chat || [])].reverse().find(m => m && !m.is_user && !m.is_system);
    const text = String(last?.mes || '').toLowerCase();
    if (!text) return [];
    return partyMembers.map(m => m.name).filter(name => text.includes(String(name).toLowerCase()));
}

/**
 * Lo que se puede hacer sin escribirlo, para la fila de fichas del Modo Juego.
 *
 * @returns {import('../game-engine/ui/shell/action-chips.js').ActionChip[]}
 */
/**
 * Z3: lo que hay aquí, para leer la caja con los nombres de aquí.
 *
 * @returns {import('../game-engine/campaign/read-box.js').BoxContext}
 */
export function boxContext() {
    const location = hereLocation();
    const shop = buildServiceCards().find(c => c.id === 'tienda');
    return {
        fighting: Boolean(combatEncounter.active),
        foes: combatEncounter.active ? getAliveEnemies().map((/** @type {any} */ e) => String(e.name)) : [],
        places: neighbourPlaces(),
        boards: currentBoardName ? [] : getLocationBoards(location).map((/** @type {any} */ b) => String(b.name)),
        onBoard: Boolean(currentBoardName),
        people: lastWorldNpcs.filter(n => !n.dead && n.where.toLowerCase() === String(currentLocationName).toLowerCase()).map(n => n.name),
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => String(m.name)),
        services: location ? servicesOf(location) : [],
        wares: (shop?.actions ?? []).filter(a => a.id.startsWith('shop-buy:')).map(a => a.id.slice('shop-buy:'.length)),
        goods: (shop?.actions ?? []).filter(a => a.id.startsWith('shop-sell:')).map(a => a.label.replace(/^Vender /, '').replace(/ \(\d+ de oro\)$/, '')),
    };
}

/** Z3: mientras la caja la lee el motor, lo escrito no se vuelve a leer como mensaje. */
export let readingBox = false;

/**
 * Z3 de ROADMAP_SIN_TOKENS: sin modelo, la caja la lee el motor. Lo escrito queda en el
 * chat, como siempre, y se hace lo que dice; si no lo entiende, lo dice y enseña qué se
 * puede escribir aquí.
 *
 * @param {string} said
 * @returns {Promise<void>}
 */
export async function readTheBox(said) {
    await ensureWorldData();
    const context = boxContext();
    const intent = readBox(said, context);
    readingBox = true;
    try {
        await sendMessageAsUser(said, '');
    } finally {
        readingBox = false;
    }
    await doBoxIntent(intent, context);
    if (isShellOpen()) refreshGameShell();
}

/**
 * Hacer lo que la caja entendió: lo mismo que la ficha o el comando de siempre.
 *
 * @param {import('../game-engine/campaign/read-box.js').BoxIntent} intent
 * @param {import('../game-engine/campaign/read-box.js').BoxContext} context
 * @returns {Promise<void>}
 */
async function doBoxIntent(intent, context) {
    const run = (/** @type {string} */ command) => import('../slash-commands.js').then(m => m.executeSlashCommandsWithOptions(command));
    const name = String(intent.name ?? '');
    const shopAction = (/** @type {string} */ prefix, /** @type {string} */ item) => buildServiceCards().find(c => c.id === 'tienda')
        ?.actions.find(a => a.id.startsWith(prefix) && (a.id.includes(item) || a.label.includes(item)))?.id ?? '';
    switch (intent.do) {
        case 'go': {
            const { reason } = await travelWithTime(name, { confirm: askBeforeTravelling });
            if (reason) toastr.info(reason, 'No se puede viajar');
            renderLocationMapsPreview();
            return;
        }
        case 'enter': await run(`/enter ${name}`); return;
        case 'leave': await run('/leave'); return;
        case 'service': openService(name); return;
        case 'talk': startTalk(name, '', String(intent.topic ?? '')); return;
        case 'threaten': startTalk(name, '', 'amenazar'); return;
        case 'duel': await run(`/convencer ${name}`); return;
        case 'pry': await run(`/sonsacar ${name}`); return;
        case 'round': {
            const member = intent.companion ? partyMembers.find(m => String(m.name) === name) : null;
            if (member) await runService(`inn-round:${member.id}`);
            else startTalk(name, '', 'ronda');
            return;
        }
        case 'attack': handlePlayerCombatAttack(name); return;
        case 'move': handlePlayerCombatMove(`${intent.x} ${intent.y}`); return;
        case 'end-turn': endPlayerCombatTurn(); return;
        case 'check': {
            // «Observo a Torres»: la tirada es con él delante.
            const npc = name ? worldNpc(name) : null;
            if (npc) setTalkingTo(npc.name);
            runSkillCheck(String(intent.skill), '', String(intent.what ?? ''));
            return;
        }
        case 'rest': await run(`/descanso ${intent.long ? 'largo' : 'corto'}`); return;
        case 'camp': await run('/acampar'); return;
        case 'explore': await run('/explorar'); return;
        case 'forage': await run('/forrajear'); return;
        case 'rumor': await run('/rumor'); return;
        case 'wait': {
            // Hasta el momento pedido, o un rato; nunca más de un día.
            const slots = getCampaignCalendar()?.slots ?? [];
            if (intent.until && slots[Number(getCampaignCalendar()?.slotIndex) || 0]?.id === intent.until) {
                postCombatNarration(`⏳ [CAMPAÑA] Ya es ${String(getCurrentSlotLabel() || '').toLowerCase()}.`);
                return;
            }
            for (let step = 0; step < 3; step++) {
                advanceCampaignSlot();
                const now = getCampaignCalendar();
                if (!intent.until || slots[Number(now?.slotIndex) || 0]?.id === intent.until) break;
            }
            postCombatNarration(`⏳ [CAMPAÑA] Esperáis. Ya es ${String(getCurrentSlotLabel() || '').toLowerCase()}.`);
            return;
        }
        case 'buy': {
            const id = name ? shopAction('shop-buy:', name) : '';
            if (id) await runService(id);
            else openService('tienda');
            return;
        }
        case 'sell': {
            const id = name === '*' ? 'shop-junk' : name ? shopAction('shop-sell:', name) : '';
            if (id) await runService(id);
            else openService('tienda');
            return;
        }
        case 'steal': {
            const id = shopAction('shop-steal:', name);
            if (id) await runService(id);
            else openService('tienda');
            return;
        }
        case 'help': openHelp(); return;
        case 'journal': openJournalSafely(); return;
        default: {
            const why = explainMiss(intent, context) || 'Eso no lo sé hacer sin narrador.';
            const tries = boxExamples(context).map(e => `«${e}»`).join(' · ');
            postCombatNarration(`🤔 [CAJA] ${why} Prueba: ${tries}. O pulsa una ficha, o «¿Qué hago?».`);
        }
    }
}

/**
 * Idea 144: lo que se le puede decir a quien se está hablando, si sigue aquí.
 *
 * @returns {Array<{id: string, label: string, icon: string, draft?: string, command?: string}>}
 */
export function currentReplies() {
    if (!talkingTo || combatEncounter.active) return [];
    const npc = lastWorldNpcs.find(n => n.name === talkingTo && n.where.toLowerCase() === String(currentLocationName).toLowerCase());
    if (!npc) return [];
    const pry = canPry({ npc, here: currentLocationName, secrets: chat_metadata?.[SECRETS_KEY], today: Math.max(1, campaignDay()) });
    // U8 y U6 del pegamento: preguntarle por el caso, si sabe algo; y convencerle, una vez al día.
    /** @type {any[]} */
    const extra = [];
    const mystery = readCases(chat_metadata?.[CASES_KEY]);
    if (cluesHere(mystery, { person: npc.name }).length > 0) {
        extra.push({ id: 'reply-case', label: `Preguntar a ${npc.name} por lo de ${mystery.active?.victim}`, icon: 'fa-magnifying-glass', command: `/caso preguntar ${npc.name}` });
    }
    if (canDuel(npc.name)) extra.push({ id: 'reply-duel', label: `Convencer a ${npc.name}`, icon: 'fa-comments', command: `/convencer ${npc.name}` });
    // Quien os planta cara no pregunta qué necesitáis: se le contesta (2026-09-28).
    return repliesFor({ name: npc.name, rumors: rumorsLeftHere(), canPry: pry.ok, extra, confronting: confrontingNow(npc.name) })
        .map(reply => (reply.action === 'pry' ? { ...reply, command: `/sonsacar ${npc.name}` } : reply));
}

/**
 * Idea 110: sonsacarle a alguien lo que esconde. Perspicacia, una vez al día por persona.
 * Si sale, su secreto pasa a la ficha que lee el narrador: desde entonces habla distinto.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function pryNpc(name) {
    const npc = lastWorldNpcs.find(n => n.name.toLowerCase() === String(name ?? '').trim().toLowerCase());
    const today = Math.max(1, campaignDay());
    const verdict = npc ? canPry({ npc, here: currentLocationName, secrets: chat_metadata?.[SECRETS_KEY], today }) : { ok: false, reason: 'No hay nadie así aquí.' };
    if (!npc || !verdict.ok || !chat_metadata) {
        toastr.info(verdict.reason, 'Sonsacar');
        return '';
    }
    const who = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ best, m) => (!best || skillModifier(m, SECRET_SKILL).modifier > skillModifier(best, SECRET_SKILL).modifier ? m : best), null);
    if (!who) return '';
    // Idea 59: sonsacar a quien habla otra lengua, también con desventaja si nadie la entiende.
    const barrier = listenerBarrier(who, SECRET_SKILL, npc.name);
    if (barrier.note) postCombatNarration(`🗣️ [CAMPAÑA] ${barrier.note}`);
    const roll = rollCheck({
        member: who, skill: SECRET_SKILL, rollD20: () => rollDiceDetailed('1d20', 20).total, dc: SECRET_DC,
        ...(barrier.edge ? { edge: barrier.edge, why: 'no habla su lengua' } : {}),
    });
    if (!roll) return '';
    showCombatDiceRoll({
        title: `${who.name}: ${roll.label}`,
        subtitle: `Sonsacar a ${npc.name}`,
        formula: `1d20${roll.modifier >= 0 ? '+' : ''}${roll.modifier}`,
        detail: `d20(${roll.natural}) ${roll.modifier >= 0 ? '+' : ''}${roll.modifier} = ${roll.total}`,
        total: roll.total,
        dc: roll.dc,
        natural: roll.natural,
        glyph: 'd20',
    });
    postCombatNarration(roll.said);
    chat_metadata[SECRETS_KEY] = notePry(chat_metadata[SECRETS_KEY], { name: npc.name, secret: String(npc.secret) }, roll.success, today);
    saveMetadata();
    if (roll.success) {
        const worldName = String(chat_metadata?.[METADATA_KEY] || '');
        await worldWrite(async () => {
            const data = await loadWorldInfo(worldName);
            const entry = Object.values(data?.entries ?? {}).find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc'
                && String(e.dndData?.name || e.comment || '').toLowerCase() === npc.name.toLowerCase());
            if (!data || !entry) return;
            const note = secretNote(String(npc.secret));
            if (!String(/** @type {any} */ (entry).content || '').includes(note)) {
                /** @type {any} */ (entry).content = `${String(/** @type {any} */ (entry).content || '')} ${note}`.trim();
                await saveWorldInfo(worldName, data, true);
            }
        });
        noteDeed(`${who.name} le sacó a ${npc.name} su secreto.`);
        toastr.success(String(npc.secret), `🗝️ Lo que escondía ${npc.name}`, { timeOut: 12000 });
        await postForModel(`[SECRETO] ${who.name} le saca a ${npc.name} lo que escondía: ${npc.secret} `
            + 'Cuéntalo en su voz, a regañadientes. No inventes nada más.');
    } else {
        toastr.info(`${npc.name} se cierra en banda. Hoy no hay nada que sacarle.`, 'Sonsacar', { timeOut: 8000 });
    }
    if (isShellOpen()) refreshGameShell();
    return roll.said;
}

/**
 * Dejar una frase empezada en el cuadro del chat, con el cursor al final.
 *
 * @param {string} text
 */
export function draftInChat(text) {
    const input = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
    if (!input) return;
    input.value = text;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Idea 59: cómo va una tirada de trato con quien se está hablando, por la lengua.
 *
 * @param {any} speaker
 * @param {string} skill
 * @param {string} [name] Con quién, si no es con quien se está hablando.
 * @returns {{edge: ''|'disadvantage', by: string, note: string}}
 */
function listenerBarrier(speaker, skill, name = '') {
    const who = String(name || talkingTo || '');
    const listener = who
        ? lastWorldNpcs.find(n => n.name.toLowerCase() === who.toLowerCase() && n.where.toLowerCase() === String(currentLocationName).toLowerCase())
        : null;
    if (!listener?.language) return { edge: '', by: '', note: '' };
    return languageBarrier({ speaker, party: partyMembers, language: listener.language, skill, listener: listener.name });
}

/**
 * Intentar algo fuera de combate: el motor tira y el narrador lee el resultado.
 *
 * El resultado viaja **dentro de tu mensaje**, que es lo unico que el modelo lee seguro.
 * Se guarda hasta que lo envias: volver a pulsar da la misma tirada, no otra.
 *
 * @param {string} skill
 * @param {string} [keep] Lo que ya estaba escrito: la tirada va delante y lo escrito se queda.
 * @param {string} [what] Z3: lo que se intenta, en infinitivo, para contarlo sin modelo.
 * @returns {string}
 */
export function runSkillCheck(skill, keep = '', what = '') {
    // Idea 138: si la pidio el narrador, con su dificultad, y la peticion se gasta.
    const asked = takeRequest(chat_metadata?.[CHECK_REQUESTS_KEY], skill, SKILLS);
    if (combatEncounter.active) {
        toastr.warning('En combate se pelea con la barra de abajo.');
        return '';
    }
    // Quién cuenta la tirada: el modelo si narra él; en «Mixto», también si la pidió él (idea
    // 138) o si hay algo escrito en la caja (lo vas a enviar, y la tirada va delante para que
    // la lea). Si no, el motor.
    const toModel = modelNarrates() || (narratorMode() === 'mixto' && (Boolean(asked.request) || Boolean(String(keep).trim())));
    const pending = chat_metadata?.[PENDING_CHECK_KEY];
    if (pending?.draft && toModel) {
        toastr.info('Ya has tirado. Envia el mensaje antes de intentar otra cosa.');
        draftInChat(String(pending.draft));
        return String(pending.line || '');
    }
    // Sin modelo no hay mensaje que la gaste: una pendiente de antes no bloquea nada (y una
    // partida que se quedó así, tras recargar, se desatasca aquí).
    if (pending && chat_metadata) delete chat_metadata[PENDING_CHECK_KEY];

    const member = partyMembers[0];
    if (!member) {
        toastr.warning('No hay nadie en el grupo que pueda intentarlo.');
        return '';
    }
    // Idea 59: si se habla con alguien de aquí que habla otra lengua.
    const barrier = listenerBarrier(member, skill);
    if (barrier.note) postCombatNarration(`🗣️ [CAMPAÑA] ${barrier.note}`);
    const result = rollCheck({
        member, skill, rollD20: () => rollDiceDetailed('1d20', 20).total,
        // Idea 140: la actitud de con quien se habla baja o sube lo que hace falta.
        dc: (asked.request ? asked.request.dc : DEFAULT_DC) - (SOCIAL_SKILLS.includes(skill) && talkingTo ? attitudeTowards(talkingTo) : 0),
        ...(barrier.edge ? { edge: barrier.edge, why: 'no habla su lengua' } : {}),
    });
    if (result && asked.request && chat_metadata) chat_metadata[CHECK_REQUESTS_KEY] = asked.requests;
    if (!result) {
        toastr.warning(`No conozco esa tirada. Hay: ${Object.keys(SKILLS).join(', ')}.`);
        return '';
    }

    // Z3: sin modelo, fallar por poco sale a medias: se consigue, pero se paga.
    const halfway = !toModel && checkOutcome(result) === 'medias';
    showCombatDiceRoll({
        title: `${member.name}: ${result.label}`,
        subtitle: result.success ? 'Sale' : halfway ? 'A medias' : 'No sale',
        formula: `1d20${result.modifier >= 0 ? '+' : ''}${result.modifier}`,
        detail: `d20(${result.natural}) ${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total}`,
        total: result.total,
        dc: result.dc,
        natural: result.natural,
        glyph: 'd20',
    });

    // Con modelo, la consecuencia la cuenta él con el mensaje que se envíe; sin modelo, la
    // tirada se cuenta aquí, y hace algo (Z3): no hay mensaje que esperar.
    if (toModel) chat_metadata[PENDING_CHECK_KEY] = { line: result.line, draft: result.draft };
    else tellCheck(member, result, what);
    // Idea 107: con el sitio, que es donde está la pista.
    notePlot({ kind: 'check', skill, success: result.success, place: currentLocationName });
    // Un encargo que se resuelve sin pelear se da por hecho con una tirada buena en su sitio.
    const takenNow = chat_metadata?.[TAKEN_KEY];
    if (settlesNoFight(takenNow, { place: currentLocationName, success: result.success })) finishTakenContract(takenNow);
    saveMetadata();
    if (toModel) draftInChat(String(keep).trim() ? `${result.line}\n${String(keep).trim()}` : result.draft);
    if (isShellOpen()) refreshGameShell();
    return result.line;
}

/**
 * Z3 de ROADMAP_SIN_TOKENS: sin modelo, una tirada se cuenta y hace algo. Bien, a medias o
 * mal, y cada resultado con su efecto en lo que ya existe: una pista del caso, un rumor,
 * unas monedas, algo de comer, un rato del día, una herida, o cómo os mira con quien se
 * habla.
 *
 * @param {any} member Quien lo intenta.
 * @param {{skill: string, success: boolean, total: number, dc: number, natural: number, said: string}} result
 * @param {string} [what] Lo que se intentaba, en infinitivo.
 * @returns {void}
 */
function tellCheck(member, result, what = '') {
    const outcome = checkOutcome(result);
    const gains = fieldGainsToday();
    const key = `${currentLocationName}|${result.skill}`;
    const fresh = !gains.keys.includes(key);
    const npc = talkingTo ? worldNpc(talkingTo) : null;
    const cases = readCases(chat_metadata?.[CASES_KEY]);
    const clue = cases.active ? cluesHere(cases, { place: currentLocationName }).find(c => !cases.found.includes(c.id)) ?? null : null;
    const effects = consequence({
        skill: result.skill,
        outcome,
        can: {
            pista: Boolean(clue), rumor: rumorsLeftHere() > 0, oro: fresh, comida: fresh,
            mirada: Boolean(npc), sabe: Boolean(npc?.knows), busca: Boolean(npc?.wants),
        },
    });
    const said = outcome === 'medias' ? result.said.replace(/ ✗ Fallo\b/, ' ✗ A medias') : result.said;
    const prose = tellMoment(`tirada-${outcome}`, { quien: String(member?.name || ''), que: String(what || '').trim(), habilidad: result.skill });
    /** @type {string[]} */
    const notes = [];
    /** @type {Array<() => void>} */
    const after = [];
    let gained = false;
    for (const effect of effects) {
        if (effect.kind === 'pista' && clue) after.push(() => revealClue(clue));
        else if (effect.kind === 'rumor') after.push(() => { void hearRumor(); });
        else if (effect.kind === 'oro') {
            const gold = Math.max(1, rollDiceDetailed(String(effect.amount || '1d4'), 4).total);
            member.gold = (Number(member.gold) || 0) + gold;
            notes.push(`Encontráis ${gold} de oro.`);
            gained = true;
        } else if (effect.kind === 'comida') {
            for (const one of partyMembers) {
                if (!one.dead) one.needs = relieve(one, 'ate');
            }
            notes.push('Algo de comer: se os pasa el hambre.');
            gained = true;
        } else if (effect.kind === 'hora') {
            // El reloj, detrás de la tirada: si no, el aviso de la hora salía antes que ella.
            after.unshift(() => { advanceCampaignSlot(); });
            notes.push('Se os va un rato.');
        } else if (effect.kind === 'herida') {
            const before = Number(member.hp) || 0;
            const hurt = /d/.test(String(effect.amount)) ? rollDiceDetailed(String(effect.amount), 4).total : Number(effect.amount) || 1;
            member.hp = Math.max(1, before - hurt);
            if (before > member.hp) notes.push(`${member.name} se hace daño: −${before - member.hp} de vida.`);
        } else if (effect.kind === 'mirada' && npc) {
            const delta = Number(effect.amount) || 0;
            after.push(() => { changeAttitude(npc.name, delta, delta > 0 ? 'le habéis convencido' : 'no le ha gustado'); });
        } else if (effect.kind === 'sabe' && npc?.knows) {
            after.push(() => { sayInTalk(npc, threatAnswer({ npc, success: true }), `${npc.name} lo suelta: ${npc.knows}`); });
        } else if (effect.kind === 'busca' && npc?.wants) {
            const wants = String(npc.wants).trim();
            notes.push(`Le caláis: lo que de verdad busca ${npc.name} es ${wants.charAt(0).toLocaleLowerCase('es')}${wants.slice(1)}`);
        }
    }
    if (outcome !== 'mal' && effects.length === 0 && !fresh) notes.push('Aquí ya no queda nada más que sacar hoy.');
    if (gained && chat_metadata) chat_metadata[FIELD_GAINS_KEY] = { ...gains, keys: [...gains.keys, key] };
    postCombatNarration(`🎲 [TIRADA] ${[`${said}.`, prose, ...notes].filter(Boolean).join(' ')}`);
    for (const run of after) run();
    savePartyState();
}

/**
 * Z3: lo que se puede examinar aquí sin que nadie lo ofrezca: dos cosas del sitio, cada una
 * con su tirada, una vez al día. Es la versión del motor de «Buscar X» y de la tirada que
 * pide el sitio, que antes solo ofrecía el modelo.
 *
 * @returns {Array<{id: string, label: string, icon: string, command: string}>}
 */
export function lookChips() {
    if (!currentLocationName || currentBoardName || combatEncounter.active || !lastCompendium?.has?.('frases')) return [];
    const place = hereLocation();
    const tipo = String(place?.locationType || place?.type || '');
    const rows = lastCompendium.find('frases', { kind: 'mirar', ...(tipo ? { tipo } : {}) });
    const own = rows.filter((/** @type {any} */ r) => r.when?.tipo);
    const pool = own.length > 0 ? own : rows;
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mirar', currentLocationName, String(campaignDay())));
    const looked = fieldGainsToday().looked;
    return pool.map((/** @type {any} */ row) => ({ row, at: random() }))
        .sort((a, b) => a.at - b.at)
        .slice(0, 2)
        .map(({ row }) => row)
        .filter((/** @type {any} */ row) => !looked.includes(`${currentLocationName}|${row.id}`))
        .map((/** @type {any} */ row) => ({
            id: `look:${row.id}`,
            label: `${String(row.verbo).charAt(0).toLocaleUpperCase('es')}${String(row.verbo).slice(1)} ${row.text}`,
            icon: SKILLS[/** @type {keyof typeof SKILLS} */ (row.skill)]?.icon ?? 'fa-eye',
            command: `/examinar ${row.id}`,
        }));
}

/**
 * Z3: examinar algo de aquí. Una de las cosas del sitio (por su id) o lo que se escriba:
 * «/examinar la cerradura del baúl».
 *
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function lookAt(value) {
    const wanted = String(value ?? '').trim();
    if (!wanted) return;
    const row = lastCompendium?.has?.('frases')
        ? lastCompendium.find('frases', { kind: 'mirar' }).find((/** @type {any} */ r) => r.id === wanted) : null;
    if (row) {
        const gains = fieldGainsToday();
        if (chat_metadata) chat_metadata[FIELD_GAINS_KEY] = { ...gains, looked: [...gains.looked, `${currentLocationName}|${row.id}`] };
        runSkillCheck(String(row.skill), '', `${row.verbo} ${row.text}`);
    } else {
        const intent = readBox(`examino ${wanted}`, boxContext());
        runSkillCheck(String(intent.skill || 'investigation'), '', intent.what || `examinar ${wanted}`);
    }
    if (isShellOpen()) refreshGameShell();
}

/**
 * Hablar con alguien: el hilo se entera, y con modelo queda la frase empezada para que la
 * termine quien juega. Sin modelo, se abre la charla (Z2).
 *
 * @param {string} name
 * @param {string} [draft] La frase empezada, para el modelo.
 * @param {string} [ask] Z3: de qué preguntar nada más abrir (`sabe`, `rumor`…) o qué hacer (`amenazar`, `ronda`).
 * @returns {void}
 */
export function startTalk(name, draft = '', ask = '') {
    const who = String(name ?? '').trim();
    if (!who) return;
    notePlot({ kind: 'talk', npc: who, place: currentLocationName });
    // Desde ahora se habla con él: con modelo, contesta él (y no el narrador).
    const known = worldNpc(who)?.name ?? partyMembers.slice(1).find(m => !m.dead && String(m.name).toLowerCase() === who.toLowerCase())?.name;
    if (known) {
        setTalkingTo(String(known));
        if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
    }
    if (modelNarrates()) {
        draftInChat(draft || `Le digo a ${who}: `);
        return;
    }
    // Z2: la charla, con temas y respuestas del motor.
    void openTalk(who, draft, ask);
}

/**
 * Lo que dice alguien en una charla: la frase del banco (o, si no hay, el dato tal cual),
 * en la ventana y en el chat, con los hechos para el modelo si lo hay.
 *
 * @param {any} npc
 * @param {{moment: string, facts: Record<string, any>}|null} plan
 * @param {string} fallback Lo que se dice si el banco no tiene frase.
 * @returns {string}
 */
function sayInTalk(npc, plan, fallback) {
    const line = (plan ? tellMoment(plan.moment, plan.facts) : '') || fallback;
    if (line) void postForModel(talkNote(npc, line), { show: `🗣️ [GENTE] ${line}` });
    return line;
}

/**
 * Z2 de ROADMAP_SIN_TOKENS: hablar con alguien sin modelo. Una ventana con de qué se puede
 * hablar (lo que sabe, lo que busca, lo que se cuenta, el caso) y qué se puede hacer
 * (convencer, sonsacar, amenazar, invitar a una ronda). Lo que contesta depende de cómo os
 * mire; y lo que dice queda en la ventana y en el chat.
 *
 * @param {string} name
 * @param {string} [draft] La frase empezada, para decírselo con tus palabras si hay modelo.
 * @param {string} [ask] Z3: lo que se pidió al escribirlo: un tema o una acción (`amenazar`, `ronda`).
 * @returns {Promise<void>}
 */
async function openTalk(name, draft = '', ask = '') {
    await ensureWorldData();
    const npc = worldNpc(name);
    // Un compañero, o alguien que el mundo no conoce: una línea, y la caja si hay modelo.
    if (!npc) {
        postCombatNarration(`🗣️ [GENTE] Hablas con ${name}.`);
        if (narratorMode() !== 'motor') draftInChat(draft || `Le digo a ${name}: `);
        return;
    }
    setTalkingTo(npc.name);
    // Cómo os mira de verdad ahora: quien os planta cara no os mira neutral (2026-09-28).
    const attitude = () => attitudeTowards(npc.name);
    const confronting = confrontingNow(npc.name);
    // Si se le ha calado (sonsacado con éxito): abre lo que busca y lo que piensa de vosotros.
    const read = () => Boolean(readSecrets(chat_metadata?.[SECRETS_KEY]).known[npc.name]);
    const same = (/** @type {any} */ a) => String(a ?? '').toLowerCase() === npc.name.toLowerCase();
    const milestone = openMilestones().find(m => m?.asks?.kind === 'talk' && same(m.asks.npc)) ?? null;
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    const hasRumor = () => lastRumors.some(r => same(r.by) && !heard.includes(r.id));
    const cases = readCases(chat_metadata?.[CASES_KEY]);
    const hasCase = Boolean(cases.active) && cluesHere(cases, { person: npc.name }).length > 0;

    const body = $('<div class="tk-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(npc.name));
    const who = $('<div class="tk-who"></div>');
    const mood = $('<span class="tk-mood"></span>');
    const drawMood = () => mood.text(`Os mira de forma ${describeAttitude(attitude())}`).attr('data-band', attitude() >= 1 ? 'buena' : attitude() < 0 ? 'mala' : 'neutra');
    drawMood();
    if (npc.trade) who.append($('<span class="tk-trade"></span>').text(npc.trade));
    who.append(mood);
    body.append(who);
    if (npc.voice) body.append($('<div class="tk-voice"></div>').text(`Cómo habla: ${npc.voice}`));
    const log = $('<div class="tk-log"></div>');
    const add = (/** @type {string} */ line) => {
        if (!line) return;
        log.append($('<div class="tk-line"></div>').text(line));
        log.scrollTop(log[0]?.scrollHeight ?? 0);
    };

    /** @type {Popup|null} */
    let popup = null;
    const topics = $('<div class="tk-topics"></div>');
    const drawTopics = () => {
        topics.empty();
        for (const topic of talkTopics({ npc, milestone, hasRumor: hasRumor(), hasCase, attitude: attitude(), read: read(), confronting })) {
            const button = $('<button type="button" class="menu_button tk-topic"></button>').attr('data-topic', topic.id)
                .append(`<i class="fa-solid ${topic.locked ? 'fa-lock' : topic.icon}"></i>`).append($('<span></span>').text(topic.label));
            // Cerrado, y diciendo cómo se abre: con relación o con una tirada.
            if (topic.locked) {
                // No va desactivado: al pulsarlo dice cómo se abre, y eso es una respuesta.
                button.addClass('tk-locked').attr('title', topic.locked);
                button.on('click', () => add(topic.locked ?? ''));
                topics.append(button);
                continue;
            }
            button.on('click', async () => {
                if (topic.id === 'rumor') {
                    const said = await hearRumor(npc.name);
                    add(said ? `${npc.name} cuenta: «${said}»` : `${npc.name} no tiene nada nuevo que contar.`);
                    drawTopics();
                    return;
                }
                if (topic.id === 'caso') {
                    const before = chat.length;
                    await askAboutCase(npc.name);
                    const told = chat.slice(before).map(m => String(m.extra?.display_text ?? m.mes ?? '')).filter(Boolean);
                    add(told.length > 0 ? told.join(' ') : `${npc.name} no sabe nada más del caso.`);
                    return;
                }
                const plan = topicAnswer({ npc, topic: topic.id, attitude: attitude(), attitudeWord: describeAttitude(attitude()), milestone });
                const fallback = topic.id === 'sabe' ? `${npc.name}: ${npc.knows}` : topic.id === 'quiere' ? `Lo que busca ${npc.name}: ${npc.wants}` : '';
                add(sayInTalk(npc, plan, fallback));
            });
            topics.append(button);
        }
    };
    drawTopics();
    body.append(topics).append(log);

    // Lo que se puede hacer, además de preguntar.
    const actions = $('<div class="tk-actions"></div>');
    const act = (/** @type {string} */ label, /** @type {string} */ icon, /** @type {() => void|Promise<void>} */ run, /** @type {string} */ title, /** @type {string} */ id = '') => {
        const button = $('<button type="button" class="menu_button tk-act"></button>').attr('title', title).attr('data-act', id)
            .append(`<i class="fa-solid ${icon}"></i>`).append($('<span></span>').text(label));
        button.on('click', () => { void run(); });
        actions.append(button);
    };
    const closeAndRun = (/** @type {string} */ command) => {
        void popup?.completeAffirmative();
        setTimeout(() => { void import('../slash-commands.js').then(m => m.executeSlashCommandsWithOptions(command)); }, 300);
    };
    act('Convencer', 'fa-comments', () => closeAndRun(`/convencer ${npc.name}`), 'El Duelo de Palabras: tres rondas, y cede o no cede', 'convencer');
    act('Sonsacar', 'fa-user-secret', () => closeAndRun(`/sonsacar ${npc.name}`), 'Perspicacia: lo que esconde, si lo notas', 'sonsacar');
    act('Amenazar', 'fa-hand-fist', () => {
        const member = partyMembers[0];
        const result = member ? rollCheck({ member, skill: 'intimidation', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: DEFAULT_DC }) : null;
        if (!result) return;
        add(noteRollInWindow(member, result));
        const plan = threatAnswer({ npc, success: result.success });
        add(sayInTalk(npc, plan, result.success ? `${npc.name} lo suelta: ${npc.knows}` : `${npc.name} no se deja amenazar.`));
        // Amenazar se paga, salga o no.
        changeAttitude(npc.name, -1, 'amenazado');
        drawMood();
    }, 'Intimidación: si sale, lo suelta aunque no os quiera; os lo tendrá en cuenta siempre', 'amenazar');
    const inn = (/** @type {any} */ (getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l.name === currentLocationName))?.services ?? []).includes('posada');
    // A quien viene a por vosotros no se le invita a una ronda.
    if (inn && !confronting) {
        act('Invitar a una ronda', 'fa-beer-mug-empty', () => {
            if (!payFromParty(2)) {
                add('No os llega ni para una ronda.');
                return;
            }
            const before = attitude();
            const result = shiftAttitude(chat_metadata?.[ATTITUDES_KEY], { name: npc.name, delta: 1, day: campaignDay() });
            if (result.ok && chat_metadata) {
                chat_metadata[ATTITUDES_KEY] = result.state;
                saveMetadata();
                refreshWorldMemoryPrompt();
            }
            const changed = attitude() !== before;
            add(sayInTalk(npc, { moment: changed ? 'charla-ronda' : 'charla-ronda-no', facts: { quien: npc.name, actitud_texto: describeAttitude(attitude()) } },
                changed ? `Una ronda para ${npc.name}.` : `${npc.name} acepta la ronda.`));
            drawMood();
            drawTopics();
        }, 'Dos de oro. Una vez al día, mejora cómo os mira', 'ronda');
    }
    // Con modelo que acompaña, también se le puede decir algo con tus palabras.
    let keepTalking = false;
    if (narratorMode() === 'mixto') {
        act('Decírselo con tus palabras', 'fa-pen', () => {
            // La conversación sigue en la caja: lo que se escriba lo contesta él.
            keepTalking = true;
            void popup?.completeAffirmative();
            draftInChat(draft || `Le digo a ${npc.name}: `);
        }, 'Lo escribes tú, y lo contesta el modelo', 'palabras');
    }
    body.append(actions);

    // De quien os planta cara no se despide uno: se cierra la ventana y sigue la escena.
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: confronting ? 'Cerrar' : 'Despedirse', allowVerticalScrolling: true, leftAlign: true });
    if (isShellOpen()) refreshGameShell();
    // Z3: «le pregunto a Giles por los rumores», «amenazo a Torres»: nada más abrir, eso.
    if (ask) setTimeout(() => body.find(`[data-topic="${ask}"], [data-act="${ask}"]`).first().trigger('click'), 80);
    const talking = popup.show();
    // J2.2: la primera charla, con la ventana ya abierta (el aviso sale encima de ella). Con
    // quien os planta cara no: ahí no hay despedida que enseñar.
    if (!confronting) showTip('talk');
    await talking;
    // «Despedirse» acaba la conversación; seguirla con tus palabras, no.
    if (!keepTalking && talkingTo === npc.name) {
        setTalkingTo('');
        if (isShellOpen()) refreshGameShell();
    }
}
