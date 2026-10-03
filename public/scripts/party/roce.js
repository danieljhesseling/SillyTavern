/**
 * E4 de wiki/ROADMAP_ENTRETENIDO.md, «Compañeros con roce»: el pegamento con la partida.
 *
 * - **E4.1, desaprobar con consecuencias** (`campaign/grudges.js`): quien está molesto no hace
 *   ataques en pareja (`sulks`, lo miran la barra y la tarjeta del enemigo) y lo dice su ficha; un
 *   mercenario harto pide más paga esa noche, junto al fuego, y si no se le convence se va.
 * - **E4.2, discusiones junto al fuego** (`campaign/campfire-arguments.js`): tras un roce de hoy o
 *   un día duro, dos de los tuyos discuten antes de dormir y tú das la razón a uno.
 * - **E4.3, misiones de los mercenarios** (`campaign/merc-quests.js`): al llegar al vínculo 3, el
 *   mercenario tiene su misión, jugable como las escritas (`companions.js`), y te la pide él junto
 *   al fuego.
 *
 * Todo pasa en `firesideTalk`, que llama la noche (`playNight` de `travel.js`) antes de lo demás:
 * una cosa por noche, en la ventana de las quedadas, con la cara de quien habla (D-J60).
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { readApproval, noteApproval } from '../game-engine/campaign/approval.js';
import {
    GRUDGES_KEY, RAISE_DC, dueRaise, easeVerdicts, grudgeOf, grudgeScore, noteRaise, raiseAsk, raiseChoice, raiseScene, readGrudges, settleRaise,
} from '../game-engine/campaign/grudges.js';
import { argumentChoice, argumentFor, argumentVerdicts, hardDay } from '../game-engine/campaign/campfire-arguments.js';
import {
    MERC_QUESTS_KEY, addMercQuest, dueMercQuests, markTold, mercAskScene, mercQuestFor, readMercQuests,
} from '../game-engine/campaign/merc-quests.js';
import { readQuestRows, readQuests, QUESTS_KEY } from '../game-engine/campaign/companion-quests.js';
import { bindCast, castOutcome } from '../game-engine/campaign/cast-scenes.js';
import { makePeace } from '../game-engine/campaign/camp-talk.js';
import { noteGone } from '../game-engine/campaign/companion-arcs.js';
import { MOURNING_DAYS } from '../game-engine/campaign/company.js';
import { keyOf } from '../game-engine/campaign/social.js';
import { cardOf } from '../game-engine/campaign/companion-cards.js';
import { wantsOf as wantsFromTrade } from '../game-engine/combat/barks.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { rollCheck } from '../game-engine/rules/checks.js';
import { openMeetupScene } from '../game-engine/ui/meetup-scene.js';
import { rollDiceDetailed } from './combat-rules.js';
import { APPROVAL_KEY, GONE_KEY } from './keys.js';
import { combatEncounter, currentLocationName, partyMembers, setPartyMembers } from './state.js';
import { campaignDay, getCampaignBonds, recordCampaignBondEvent } from './time.js';
import { partyPurse, payFromParty, renderPartyMembers, savePartyState } from './roster.js';
import { currentSurvival } from './modes.js';
import { postCombatNarration } from './narration.js';
import { noteDeed } from './world-growth.js';
import { companionCards } from './companions.js';

/** @param {any} m @returns {boolean} */
const standing = (m) => Boolean(m) && !m.dead && (Number(m.hp ?? 1) || 0) > 0 && m.guest?.kind !== 'ward';

// ---------------------------------------------------------------------------------------
// E4.1: el disgusto.

/**
 * Cómo está alguien por lo último que habéis hecho (sus 👍 y 👎 de las dos últimas semanas).
 *
 * @param {any} member
 * @returns {import('../game-engine/campaign/grudges.js').Grudge}
 */
export function grudgeFor(member) {
    const score = chat_metadata ? grudgeScore(chat_metadata[APPROVAL_KEY], String(member?.id ?? ''), campaignDay()) : 0;
    return grudgeOf(member, score);
}

/**
 * Si está molesto: no hace ataques en pareja ni su jugada del vínculo.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function sulks(member) {
    if (!member || !chat_metadata || member === partyMembers[0]) return false;
    return grudgeFor(member).sulks;
}

/**
 * Lo que dice su ficha del disgusto y del sueldo: vacío si no hay nada que decir.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function grudgeLines(member) {
    const lines = [grudgeFor(member).label];
    const raise = Math.max(0, Math.floor(Number(member?.wageRaise) || 0));
    if (raise > 0) lines.push(`Cobra ${raise} de oro más a la semana desde que pidió más paga.`);
    return lines.filter(Boolean);
}

/**
 * Se va del gremio: sale del grupo y queda apuntado por si un día vuelve (R8).
 *
 * @param {any} member
 * @param {string} why
 */
function leaveGuild(member, why) {
    if (!chat_metadata || !member) return;
    chat_metadata[GONE_KEY] = noteGone(chat_metadata[GONE_KEY], member, campaignDay(), why);
    setPartyMembers(partyMembers.filter(m => m !== member));
    savePartyState();
    renderPartyMembers();
    noteDeed(`${member.name} dejó el gremio: ${why}.`);
}

// ---------------------------------------------------------------------------------------
// E4.3: las misiones de los mercenarios.

/**
 * Lo que busca alguien para su misión: lo que diga su ficha o, en un mercenario (que va por el
 * oro), lo de su oficio, para que no todos quieran lo mismo.
 *
 * @param {any} member
 * @returns {string}
 */
function questWants(member) {
    const card = cardOf(companionCards(), String(member?.name ?? ''));
    if (card?.wants) return card.wants;
    return wantsFromTrade({ className: member?.class ?? member?.className ?? '' });
}

/**
 * Hacer la misión de los mercenarios que ya llegan al vínculo 3 y aún no la tienen.
 *
 * @param {Iterable<string>} written Las claves de quien ya tiene misión escrita.
 * @returns {boolean} Si se ha hecho alguna.
 */
export function ensureMercQuests(written = []) {
    if (!chat_metadata?.[METADATA_KEY]) return false;
    const bonds = getCampaignBonds();
    const due = dueMercQuests({
        party: partyMembers, rankOf: m => getBondProgress(bonds, String(m.id)).rank, store: chat_metadata[MERC_QUESTS_KEY], written: [...written],
    });
    if (due.length === 0) return false;
    let store = chat_metadata[MERC_QUESTS_KEY];
    for (const member of due) {
        const random = createSeededRandom(derive(String(chat_metadata[METADATA_KEY] || ''), 'mision-mercenario', String(member.id)));
        store = addMercQuest(store, mercQuestFor({
            member, wants: questWants(member), random, heroName: String(partyMembers[0]?.name ?? ''), size: partyMembers.filter(standing).length,
        }));
    }
    chat_metadata[MERC_QUESTS_KEY] = store;
    saveMetadata();
    return true;
}

/**
 * Las misiones de los mercenarios, leídas como las de `personales.json`.
 *
 * @returns {import('../game-engine/campaign/companion-quests.js').QuestRow[]}
 */
export function mercQuestRows() {
    return chat_metadata ? readQuestRows(readMercQuests(chat_metadata[MERC_QUESTS_KEY]).rows) : [];
}

/**
 * Lo que diría `quedadas.json` de la misión de un mercenario (título, de qué va, sus finales), o
 * nulo si no es de un mercenario.
 *
 * @param {string} questId
 * @returns {import('../game-engine/campaign/merc-quests.js').MercQuestInfo|null}
 */
export function mercQuestInfo(questId) {
    if (!chat_metadata) return null;
    return readMercQuests(chat_metadata[MERC_QUESTS_KEY]).infos[String(questId)] ?? null;
}

// ---------------------------------------------------------------------------------------
// Junto al fuego.

/**
 * @typedef {Object} FiresidePlace
 * @property {boolean} inn En la posada (o en la del gremio).
 * @property {string} campaign El paquete, para los retratos y el fondo.
 * @property {number} day
 */

/**
 * Enseñar una charla montada con `bindCast`, de noche.
 *
 * @param {import('../game-engine/campaign/cast-scenes.js').CastScene} scene
 * @param {FiresidePlace} where
 * @param {(choices: Array<{beat: number, reply: number}>) => string[]} summarize
 * @param {boolean} [canLeave]
 * @returns {Promise<{finished: boolean, choices: Array<{beat: number, reply: number}>}>}
 */
function showTalk(scene, where, summarize, canLeave = true) {
    const first = scene.cast.find(c => c.name === scene.who) ?? scene.cast[0] ?? { name: scene.who };
    return openMeetupScene({
        scene: /** @type {any} */ (scene),
        person: first,
        cast: scene.cast,
        pack: where.campaign,
        place: where.inn ? 'posada' : '',
        town: String(currentLocationName || ''),
        night: true,
        placeLabel: where.inn ? 'De noche, en la posada' : 'De noche, junto al fuego',
        canLeave,
        summarize,
    });
}

/**
 * Los vínculos que mueve lo contestado.
 *
 * @param {import('../game-engine/campaign/cast-scenes.js').CastScene} scene
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {string[]}
 */
function applyBonds(scene, choices) {
    const outcome = castOutcome({ scene, choices, party: partyMembers, cards: companionCards() });
    for (const bond of outcome.bonds) for (const event of bond.events) recordCampaignBondEvent(bond.id, event);
    return outcome.lines.filter(line => line !== 'La noche sigue, sin más.');
}

/**
 * E4.1: un mercenario harto pide más paga.
 *
 * @param {any} member
 * @param {FiresidePlace} where
 * @returns {Promise<string>}
 */
async function playRaise(member, where) {
    const hero = partyMembers[0];
    const day = where.day;
    const id = String(member.id);
    const score = grudgeScore(chat_metadata[APPROVAL_KEY], id, day);
    const ask = raiseAsk(member, { weekly: Boolean(currentSurvival()?.upkeep) });
    const canPay = ask.weekly || partyPurse() >= ask.amount;
    const roll = rollCheck({ member: hero, skill: 'persuasion', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: RAISE_DC });
    const persuasion = { total: Number(roll?.total) || 0, dc: RAISE_DC, success: Boolean(roll?.success) };
    const why = readApproval(chat_metadata[APPROVAL_KEY]).log.filter(e => e.id === id && e.mood < 0).pop()?.what ?? '';
    const { row, kinds } = raiseScene({ member, ask, canPay, persuasion, why });
    const scene = bindCast({ row, kind: 'pareja', slots: { a: member }, hero, party: partyMembers, cards: companionCards() });
    /** @type {import('../game-engine/campaign/grudges.js').RaiseResult|null} */
    let result = null;
    await showTalk(scene, where, (choices) => {
        const choice = raiseChoice(kinds, choices);
        result = settleRaise({ member, choice, ask, persuasion, score });
        const lines = applyBonds(scene, choices);
        if (choice === 'convencer' && roll?.said) postCombatNarration(roll.said);
        return [result.line, ...lines].filter(Boolean);
    }, false);
    chat_metadata[GRUDGES_KEY] = noteRaise(chat_metadata[GRUDGES_KEY], { id, day, weekly: result?.stays ? result.weekly : 0 });
    const settled = /** @type {import('../game-engine/campaign/grudges.js').RaiseResult|null} */ (result);
    if (!settled) {
        saveMetadata();
        return '';
    }
    if (settled.stays) {
        if (settled.weekly > 0) member.wageRaise = Math.max(0, Math.floor(Number(member.wageRaise) || 0)) + settled.weekly;
        if (settled.once > 0 && payFromParty(settled.once)) member.gold = Math.max(0, Number(member.gold) || 0) + settled.once;
        if (settled.ease > 0) chat_metadata[APPROVAL_KEY] = noteApproval(chat_metadata[APPROVAL_KEY], easeVerdicts(member, settled.ease, settled.what), day).state;
        savePartyState();
    } else {
        leaveGuild(member, 'quería más paga');
    }
    saveMetadata();
    if (settled.line) postCombatNarration(`🌙 [NOCHE] ${settled.line}`);
    return settled.line;
}

/**
 * E4.2: dos de los tuyos discuten, y das la razón a uno.
 *
 * @param {import('../game-engine/campaign/campfire-arguments.js').Argument} argument
 * @param {FiresidePlace} where
 * @returns {Promise<string>}
 */
async function playArgument(argument, where) {
    const { scene, a, b } = argument;
    /** @type {string[]} */
    let told = [];
    const shown = await showTalk(scene, where, (choices) => {
        const lines = applyBonds(scene, choices);
        const choice = argumentChoice(scene, choices);
        const verdicts = argumentVerdicts(choice, a, b);
        if (verdicts.length > 0) chat_metadata[APPROVAL_KEY] = noteApproval(chat_metadata[APPROVAL_KEY], verdicts, where.day).state;
        if (choice === 'paz') {
            const peace = makePeace(chat_metadata[APPROVAL_KEY], String(a.id), String(b.id), where.day);
            chat_metadata[APPROVAL_KEY] = peace.state;
            lines.push(`${a.name} y ${b.name} lo dejan estar por esta noche.`);
        }
        told = lines;
        return lines;
    });
    chat_metadata[GRUDGES_KEY] = { ...readGrudges(chat_metadata[GRUDGES_KEY]), argued: where.day };
    saveMetadata();
    if (!shown.finished || told.length === 0) return '';
    const said = `${scene.title}: ${a.name} y ${b.name}. ${told.join(' ')}`;
    postCombatNarration(`🌙 [NOCHE] ${said}`);
    return said;
}

/**
 * E4.3: el mercenario te pide su misión, junto al fuego.
 *
 * @param {any} member
 * @param {any} row
 * @param {import('../game-engine/campaign/merc-quests.js').MercQuestInfo} info
 * @param {FiresidePlace} where
 * @returns {Promise<string>}
 */
async function playMercAsk(member, row, info, where) {
    const scene = bindCast({ row: mercAskScene(info), kind: 'pareja', slots: { a: member }, hero: partyMembers[0], party: partyMembers, cards: companionCards() });
    const shown = await showTalk(scene, where, (choices) => [...applyBonds(scene, choices), `Su misión, «${info.title}», está en su ficha: pulsa su retrato.`]);
    if (!shown.finished) return '';
    chat_metadata[MERC_QUESTS_KEY] = markTold(chat_metadata[MERC_QUESTS_KEY], String(row.id));
    saveMetadata();
    const said = `${member.name} os ha contado lo suyo: ${info.title}.`;
    postCombatNarration(`🌙 [NOCHE] ${said}`);
    return said;
}

/**
 * Lo que se dicen esta noche junto al fuego, antes que lo demás de la noche: un mercenario que
 * pide más paga, una discusión o un mercenario que te pide lo suyo. Una cosa por noche.
 *
 * @param {FiresidePlace} where
 * @returns {Promise<string|null>} Lo contado (vacío si se dejó a medias), o nulo si no pasó nada.
 */
export async function firesideTalk(where) {
    if (!chat_metadata || combatEncounter.active || !partyMembers[0]) return null;
    const day = Math.max(1, Math.floor(Number(where.day) || campaignDay()));
    const place = { ...where, day };
    const state = readGrudges(chat_metadata[GRUDGES_KEY]);

    const asking = dueRaise({ party: partyMembers, scoreOf: m => grudgeScore(chat_metadata[APPROVAL_KEY], String(m.id), day), state, day });
    if (asking) return await playRaise(asking, place);

    const random = createSeededRandom(derive(String(chat_metadata[METADATA_KEY] || ''), 'discusion', String(currentLocationName), String(day)));
    const frictions = readApproval(chat_metadata[APPROVAL_KEY]).frictions.filter(f => f.day === day);
    const deadToday = partyMembers.filter(m => m?.mourning && Number(m.mourning.until) - day >= MOURNING_DAYS).length;
    const argument = argumentFor({
        party: partyMembers, frictions, hard: hardDay({ party: partyMembers, deadToday }), day, lastArgued: state.argued, random, cards: companionCards(),
    });
    if (argument) return await playArgument(argument, place);

    const store = readMercQuests(chat_metadata[MERC_QUESTS_KEY]);
    const started = readQuests(chat_metadata[QUESTS_KEY]).quests;
    for (const row of store.rows) {
        if (store.told.includes(String(row.id)) || started[String(row.id)]) continue;
        const member = partyMembers.find(m => standing(m) && keyOf(m.name) === keyOf(row.who));
        if (member) return await playMercAsk(member, row, store.infos[String(row.id)], place);
    }
    return null;
}

