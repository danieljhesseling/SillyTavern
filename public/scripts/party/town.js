/**
 * El pueblo: sus servicios y tiendas (comprar, vender, regatear, robar), el herrero, los
 * remedios, los rumores, las cartas, las fiestas, la fama, los prisioneros y los dados de la
 * taberna.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata } from '../../script.js';
import {
    getCurrentWorldLocationMaps, loadWorldInfo, saveWorldInfo, refreshWorldMapGlobals, METADATA_KEY,
} from '../world-info.js';
import { addItemToInventory, removeItemFromInventory, createItem } from '../dnd-system.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { priceFactor } from '../game-engine/campaign/factions.js';
import { marketPressure, warPressure } from '../game-engine/campaign/economy.js';
import { abilitiesFor, asAbility } from '../game-engine/compendio/skills.js';
import { rollDiceDetailed, nextRandom } from './combat-rules.js';
import { weaponOf as heldWeapon } from '../game-engine/rules/equipment.js';
import { duelTricks } from '../game-engine/rules/field-uses.js';
import { favorDiscount } from '../game-engine/campaign/companion-arcs.js';
import { rumorsFromPlay } from '../game-engine/campaign/world-echoes.js';
import { seasonalMarket, magicStance } from '../game-engine/campaign/season-market.js';
import { grimoireAbilities, spellsForClass } from '../game-engine/rules/grimoire.js';
import { THROWABLES } from '../game-engine/combat/throwables.js';
import { hasMaster, lessonsHere } from '../game-engine/campaign/masters.js';
import {
    startGame, drawDie, stand, cheat, payout, describeGame, roundsLeft, BETS,
} from '../game-engine/campaign/tavern-dice.js';
import { MOUNTS, addMount, describeMounts } from '../game-engine/world/mounts.js';
import { canCraft, cloakItem, upgradedWeapon, RECIPES } from '../game-engine/campaign/trophies.js';
import { respecCost } from '../game-engine/rules/respec.js';
import { roundPrompt, topicHits, TOPICS } from '../game-engine/campaign/camp-talk.js';
import { stealDC, stealOutcome } from '../game-engine/campaign/crime.js';
import { hirelingsHere } from '../game-engine/campaign/guests.js';
import { healInjuries, treatmentCost } from '../game-engine/rules/injuries.js';
import { relieve } from '../game-engine/rules/needs.js';
import { readRemedies, remediesFor, applyRemedy } from '../game-engine/rules/remedies.js';
import { borrow, repay, LOAN } from '../game-engine/campaign/patronage.js';
import { gravesAt } from '../game-engine/campaign/legacy.js';
import { addFame, fameAt, fameNote } from '../game-engine/campaign/fame.js';
import { templeWork, identify, liftCurse, TEMPLE_PRICES } from '../game-engine/campaign/item-lore.js';
import { rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import { shiftFortune, fortuneLine } from '../game-engine/world/fortune.js';
import { handFrom, duelOutcome } from '../game-engine/campaign/word-duel.js';
import { readCases, cluesHere } from '../game-engine/campaign/cases.js';
import { chronicleOf } from '../game-engine/campaign/chronicle.js';
import { nextRumor, describeRumor } from '../game-engine/campaign/rumors.js';
import { servicesOf, serviceActions, SERVICE_INFO } from '../game-engine/campaign/services.js';
import { dealWith, BOUNTY } from '../game-engine/campaign/prisoners.js';
import { findShortcut, applyShortcut } from '../game-engine/world/road.js';
import { basePrice, weeklyStock, priceToday, sellPrice, canSell, junkOf } from '../game-engine/campaign/shop.js';
import { festivalsOf, festivalToday } from '../game-engine/world/festivals.js';
import { readLetters, newLetters } from '../game-engine/campaign/letters.js';
import { recruitActions } from '../game-engine/campaign/recruit.js';
import { lastMemoryWith } from '../game-engine/campaign/memories.js';
import { readReasons } from '../game-engine/rules/companions.js';
import { describeLootItem, declaredLootNames } from '../game-engine/combat/loot-items.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    CASES_KEY, DEBT_KEY, DEEDS_KEY, DICE_GAME_KEY, FAME_KEY, FESTIVAL_TOLD_KEY, GRAVES_KEY, HAGGLE_KEY,
    LETTERS_KEY, LETTERS_SENT_KEY, MEMORIES_KEY, MOUNTS_KEY, PRISONERS_KEY, RUMORS_HEARD_KEY, RUMORS_HEARD_ON_KEY,
    TAKEN_KEY, WANTED_KEY,
} from './keys.js';
import { combatEncounter, currentLocationName, partyMembers, worldItemCatalogue } from './state.js';
import { syncCurse } from './sheet.js';
import { respecMember } from './level-up.js';
import { petTricks } from './pet.js';
import { learnAbility, neededComponents } from './magic.js';
import { hireMercenary } from './contracts.js';
import { openGuild } from './hub.js';
import { playDuel, searchCaseHere } from './cases.js';
import {
    currentSeason, ensureWorldData, hereLocation, lastCompendium, lastRumors, lastWorldNpcs, seedOfWorld,
} from './world.js';
import { getCurrentWorldFactions, nudgeRuler, rulerOf, shiftFactionStanding } from './factions.js';
import {
    advanceCampaignSlot, campaignDay, currentUpkeepRules, getCampaignBonds, getCampaignCalendar, getDebt,
    recordCampaignBondEvent, takeRest,
} from './time.js';
import { revealLocations } from './plot.js';
import { noteDeed, worldWrite } from './world-growth.js';
import { postCombatNarration, postEngineLine, postForModel, tellMoment } from './narration.js';
import { partyPurse, payFromParty, renderPartyMembers, savePartyState } from './roster.js';
import { currentRecruits, favorsHere, hireRecruit, judgeDecision, meetRecruit } from './companions.js';
import { startTalk } from './talk.js';
import { countStat, showHelpSections } from './main.js';

/**
 * Como esta el mercado donde esta el grupo.
 *
 * Un paso cerrado no es solo un rodeo: es comida que no llega. Sin facciones ni caminos
 * cerrados devuelve 1 y la cuenta sale como salia siempre.
 *
 * @returns {any}
 */
export function currentMarket() {
    return marketPressure({
        here: currentLocationName,
        locations: getCurrentWorldLocationMaps(),
        factions: getCurrentWorldFactions(),
    });
}

/**
 * Escuchar lo que se cuenta aqui.
 *
 * Uno cada vez, sin repetir. Si lleva a un sitio escondido, oirlo lo pone en el mapa: es la
 * forma mas natural de descubrir.
 *
 * @returns {Promise<string>}
 */
export async function hearRumor(by = '') {
    await ensureWorldData();
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    // R9: primero lo que se cuenta de vosotros, luego lo del guion.
    const played = rumorsFromPlay(chronicleOf(Array.isArray(chat) ? chat : []), { told: heard })
        .map(r => ({ id: r.id, text: r.text, where: currentLocationName, by: 'Alguien en la taberna', truth: '', leadsTo: '' }));
    // Z2: preguntado a alguien, lo que cuenta él.
    const pool = by ? lastRumors.filter(r => String(r.by || '').toLowerCase() === String(by).toLowerCase()) : [...played, ...lastRumors];
    const rumor = by
        ? pool.find(r => !heard.includes(r.id)) ?? null
        : nextRumor({ rumors: pool, here: currentLocationName, heard });
    if (!rumor) {
        toastr.info('Aquí ya no se cuenta nada que no hayas oído.');
        return '';
    }
    chat_metadata[RUMORS_HEARD_KEY] = [...heard, rumor.id];
    countStat('rumors');
    // Idea 91: cuando se oyo, para saber si ya se ha enfriado.
    chat_metadata[RUMORS_HEARD_ON_KEY] = {
        ...(chat_metadata[RUMORS_HEARD_ON_KEY] ?? {}),
        [rumor.id]: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
    };
    saveMetadata();
    if (rumor.leadsTo) await revealLocations([rumor.leadsTo]);
    await postForModel(`[RUMOR] ${describeRumor(rumor)}`);
    // Idea 72: a veces, de paso, alguien menciona un camino de pastores.
    await learnShortcut(String(rumor.id));
    if (isShellOpen()) refreshGameShell();
    return rumor.text;
}

/**
 * Idea 86: lo que en este sitio se sabe del grupo, para que la gente salude con eso.
 *
 * @returns {{place: string, lines: string[]}|null}
 */
export function localMemory() {
    if (!currentLocationName || !chat_metadata) return null;
    const place = currentLocationName.toLowerCase();
    const said = (Array.isArray(chat_metadata[DEEDS_KEY]) ? chat_metadata[DEEDS_KEY] : [])
        .filter((/** @type {any} */ d) => String(d?.text ?? '').toLowerCase().includes(place))
        .slice(-2)
        .map((/** @type {any} */ d) => String(d.text));
    const fortune = fortuneLine(hereLocation());
    // Idea 52: si aquí os conocen. Idea 36: quién está enterrado aquí.
    const fame = fameNote(chat_metadata[FAME_KEY], currentLocationName);
    const buried = gravesAt(chat_metadata[GRAVES_KEY], currentLocationName).map(g => `Aquí está enterrado ${g.name}.`);
    const lines = [fortune, fame, ...buried, ...said].filter(Boolean);
    return lines.length > 0 ? { place: currentLocationName, lines } : null;
}

/**
 * Idea 52: sumar fama en un sitio, y avisar si se sube un peldaño.
 *
 * @param {string} place
 * @param {number} [amount]
 */
export function raiseFame(place, amount = 1) {
    if (!chat_metadata || !String(place ?? '').trim()) return;
    const out = addFame(chat_metadata[FAME_KEY], String(place), amount);
    chat_metadata[FAME_KEY] = out.fame;
    saveMetadata();
    if (out.rose) toastr.success(`En ${place} ${out.label}.`, '🌟 Fama', { timeOut: 8000 });
}

/**
 * Vender: cada cosa la vende quien la lleva, y el oro va a su bolsa (ideas 118 y L5).
 *
 * @param {Array<{memberId: string, itemId: string, name: string, price: number}>} sales
 */
function sellItems(sales) {
    let total = 0;
    for (const sale of sales) {
        const member = partyMembers.find(m => String(m.id) === sale.memberId);
        if (!member) continue;
        removeItemFromInventory(/** @type {any} */ (member), sale.itemId);
        member.gold = (Number(member.gold) || 0) + sale.price;
        total += sale.price;
    }
    if (total === 0) return;
    savePartyState();
    countStat('gold', total);
    postCombatNarration(`🪙 [TIENDA] Vendéis ${sales.map(s => s.name).join(', ')}: ${total} de oro.`);
    toastr.success(`${total} de oro`, 'Vendido', { timeOut: 5000 });
}

/** Idea 126: regatear, una vez al dia en cada tienda. */
async function haggle() {
    if (!chat_metadata) return;
    const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'persuasion').modifier > skillModifier(top, 'persuasion').modifier ? m : top), null);
    if (!who) return;
    // U6 del pegamento: regatear es un duelo de tres rondas. El tendero de cada sitio tiene
    // siempre la misma postura: la semilla del mundo y el sitio la deciden.
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'tendero', currentLocationName));
    const stance = ['codicioso', 'desconfiado', 'orgulloso'][Math.floor(random() * 3) % 3];
    const keeper = `El tendero de ${currentLocationName || 'aquí'}`;
    const bonds = getCampaignBonds();
    const hand = handFrom({
        modifiers: {
            persuasion: skillModifier(who, 'persuasion').modifier,
            deception: skillModifier(who, 'deception').modifier,
            intimidation: skillModifier(who, 'intimidation').modifier,
        },
        companions: partyMembers.filter(m => m !== who && !m.dead).map(m => ({ name: String(m.name), rank: getBondProgress(bonds, String(m.id)).rank })),
        allowCoin: false,
        tricks: [...duelTricks(who), ...petTricks()],
    });
    const final = await playDuel({ npc: { name: keeper, stance }, patience: 7, hand, rounds: 3, speaker: String(who.name), what: 'rebajar el precio' });
    const outcome = duelOutcome(final) ?? 'no-cede';
    const discount = outcome === 'cede' ? 0.2 : outcome === 'a-medias' ? 0.1 : 0;
    chat_metadata[HAGGLE_KEY] = {
        place: currentLocationName,
        day: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        ok: discount > 0,
        discount,
    };
    saveMetadata();
    // Un regateo no merece una llamada al modelo: se cuenta en el chat y ya.
    postCombatNarration(`🛒 [TIENDA] ${who.name} regatea con ${keeper.toLowerCase()}: ${discount > 0 ? `${Math.round(discount * 100)} % menos para hoy${outcome === 'a-medias' ? ', a medias' : ''}` : 'no cede, hoy al precio que hay'}.`);
    if (isShellOpen()) refreshGameShell();
}

/**
 * Idea 113: leer una carta, contarla y guardarla en la cronica.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function readLetter(id) {
    if (!chat_metadata) return;
    const letters = readLetters(chat_metadata[LETTERS_KEY]);
    const letter = letters.find(l => l.id === id);
    if (!letter) return;
    chat_metadata[LETTERS_KEY] = letters.filter(l => l.id !== id);
    saveMetadata();
    noteDeed(`Carta de ${letter.from}: ${letter.text}`);
    await postForModel(`[CARTA] ${letter.text} Cuéntalo como una carta que os dan en la posada: el papel, la letra, quién la trae. No inventes nada más de lo que dice.`);
}

/** Idea 113: las cartas de hoy, a la posada. */
export function writeLetters() {
    if (!chat_metadata) return;
    const debt = getDebt();
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const sent = Array.isArray(chat_metadata[LETTERS_SENT_KEY]) ? chat_metadata[LETTERS_SENT_KEY].map(String) : [];
    const fresh = newLetters({
        factions: getCurrentWorldFactions(),
        debt: debt ? { amount: Number(debt.owed) || Number(debt.amount) || 0, due: Number(debt.dueDay) || 0, creditor: debt.patronName } : null,
        today,
        sent,
    });
    if (fresh.length === 0) return;
    chat_metadata[LETTERS_KEY] = [...readLetters(chat_metadata[LETTERS_KEY]), ...fresh].slice(-4);
    chat_metadata[LETTERS_SENT_KEY] = [...sent, ...fresh.map(l => l.id)].slice(-60);
    saveMetadata();
    toastr.info(fresh.map(l => l.from).join(', '), 'Hay cartas para vosotros en la posada', { timeOut: 7000 });
}

/**
 * Las fiestas del mundo abierto (idea 89), por sitio.
 *
 * @returns {Record<string, {day: number, name: string}>}
 */
export function worldFestivals() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    return festivalsOf(getCurrentWorldLocationMaps(), key => createSeededRandom(derive(worldName, 'fiesta', key)));
}

/** @returns {{day: number, name: string}|null} La fiesta de hoy aqui. */
function festivalHere() {
    return festivalToday(worldFestivals(), currentLocationName, Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)));
}

/** Idea 89: contar la fiesta de hoy, una vez. */
export function tellFestival() {
    const festival = festivalHere();
    if (!festival || !chat_metadata) return;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const stamp = `${today}:${currentLocationName}`;
    if (chat_metadata[FESTIVAL_TOLD_KEY] === stamp) return;
    chat_metadata[FESTIVAL_TOLD_KEY] = stamp;
    saveMetadata();
    const line = `Hoy es ${festival.name} en ${currentLocationName}: la comida de la posada corre a cuenta del pueblo y en la tienda rebajan.`;
    toastr.success(line, '¡Fiesta!', { timeOut: 9000 });
    void postForModel(`[FIESTA] ${line} Que se note en la calle: música, gente, puestos. No inventes nada más.`);
}

/**
 * La tienda de aqui esta semana (ideas 118, 126, 127 y 134), con sus precios de hoy.
 *
 * @returns {{stock: Array<{name: string, price: number, reasons: string[]}>, reasons: string[], haggled: boolean, triedToday: boolean}}
 */
function shopHere() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const week = Math.floor((today - 1) / 7);
    const ruler = rulerOf(currentLocationName);
    const market = currentMarket();
    const haggle = chat_metadata?.[HAGGLE_KEY];
    const triedToday = Boolean(haggle && haggle.place === currentLocationName && Number(haggle.day) === today);
    const haggled = triedToday && Boolean(haggle.ok);
    // U6 del pegamento: lo que rebajó el duelo, si lo dice; si no, lo de siempre.
    const haggleOff = haggled ? (Number(haggle.discount) > 0 ? Number(haggle.discount) : true) : false;
    const names = weeklyStock({
        names: declaredLootNames(),
        describe: (name) => describeLootItem(name),
        random: createSeededRandom(derive(worldName, 'tienda', currentLocationName, String(week))),
        reputation: Number(ruler?.reputation) || 0,
        // Idea 122: el aceite y la red, siempre. R4: y lo que gastan los conjuros que sabéis.
        always: [...Object.values(THROWABLES).map(t => t.name), ...neededComponents()],
    });
    // Idea 84: con una guerra en marcha, el acero se paga caro.
    const war = warPressure({ here: currentLocationName, factions: getCurrentWorldFactions() });
    // Idea 52: donde os conocen, os lo dejan mejor.
    const fame = fameAt(chat_metadata?.[FAME_KEY], currentLocationName);
    // T4: la estación y cómo ve la magia quien manda aquí.
    const season = currentSeason();
    const stance = magicStance(ruler);
    const stock = names.flatMap(name => {
        const spec = describeLootItem(name);
        const steel = ['weapon', 'armor'].includes(String(spec.category));
        const food = Number(market?.food) || 1;
        const seasonal = seasonalMarket({ name, spec, season, magic: stance, ruler: String(ruler?.name ?? '') });
        if (seasonal.banned) return [];
        return [{
            name,
            ...priceToday({
                base: basePrice(spec),
                market: Math.round((steel ? food * war.steel : food) * seasonal.factor * 100) / 100,
                marketReasons: [...(Array.isArray(market?.reasons) ? market.reasons : []), ...(steel ? war.reasons : []), ...seasonal.reasons],
                // R8: y si quien atiende os aprecia, un poco menos.
                standing: (ruler ? priceFactor(Number(ruler.reputation) || 0) : 1) * (1 - favorDiscount(favorsHere(), 'tienda').discount),
                ruler: String(ruler?.name ?? ''),
                haggled: haggleOff,
                festival: Boolean(festivalHere()),
                fame: { discount: fame.discount, label: fame.label },
            }),
        }];
    });
    return { stock, reasons: [...new Set(stock.flatMap(s => s.reasons))], haggled, triedToday };
}

/**
 * Idea 7: que hacer con un prisionero.
 *
 * @param {string} what interrogar, entregar o soltar.
 * @param {string} id
 * @returns {Promise<string>}
 */
export async function handlePrisoner(what, id) {
    if (!chat_metadata) return '';
    const kind = /^interrog/i.test(what) ? 'ask' : /^entreg/i.test(what) ? 'give' : 'free';
    const { prisoner, prisoners } = dealWith(chat_metadata[PRISONERS_KEY], id, kind);
    if (!prisoner) {
        toastr.warning('No hay ningún prisionero así.');
        return '';
    }
    chat_metadata[PRISONERS_KEY] = prisoners;
    saveMetadata();
    // Idea 28: lo que les parece a los tuyos lo que haces con él.
    judgeDecision(kind === 'ask' ? 'interrogar' : kind === 'give' ? 'entregar-prisionero' : 'soltar-prisionero');
    if (kind === 'ask') {
        const heard = Array.isArray(chat_metadata[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
        const rumor = lastRumors.find(r => !heard.includes(r.id));
        if (!rumor) {
            await postForModel(`[INTERROGATORIO] ${prisoner.name} no sabe nada que no sepáis ya. Cuéntalo en una frase.`);
            return 'nada';
        }
        chat_metadata[RUMORS_HEARD_KEY] = [...heard, rumor.id];
        chat_metadata[RUMORS_HEARD_ON_KEY] = { ...(chat_metadata[RUMORS_HEARD_ON_KEY] ?? {}), [rumor.id]: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)) };
        saveMetadata();
        if (rumor.leadsTo) await revealLocations([rumor.leadsTo]);
        await postForModel(`[INTERROGATORIO] ${prisoner.name} acaba contando lo que sabe: ${rumor.text} `
            + 'Cuéntalo en su voz, a regañadientes. No inventes nada más.');
        return rumor.text;
    }
    if (kind === 'give') {
        const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
        if (holder) holder.gold = (Number(holder.gold) || 0) + BOUNTY;
        savePartyState();
        const place = currentLocationName.toLowerCase();
        const rulers = getCurrentWorldFactions().find(f => String(f.seat ?? '').toLowerCase() === place
            || (f.holds ?? []).some((/** @type {string} */ h) => String(h).toLowerCase() === place));
        if (rulers) void shiftFactionStanding(String(rulers.id), 1);
        noteDeed(`Entregasteis a ${prisoner.name} en ${currentLocationName}${rulers ? ` (${rulers.name} lo agradece)` : ''}.`);
        toastr.success(`+${BOUNTY} de oro${rulers ? ` · ${rulers.name} os mira mejor` : ''}`, `${prisoner.name}, entregado`);
        return 'entregado';
    }
    noteDeed(`Soltasteis a ${prisoner.name}.`);
    postCombatNarration(`🕊️ [CAMPAÑA] ${prisoner.name} se va sin mirar atrás.`);
    return 'suelto';
}

/**
 * Idea 72: un atajo que se oye en la posada, con la semilla del mundo.
 *
 * @param {string} about
 * @returns {Promise<void>}
 */
function learnShortcut(about) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return Promise.resolve();
    return worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const maps = data?.metadata?.locationMaps;
        if (!Array.isArray(maps)) return;
        const shortcut = findShortcut({
            locations: maps, from: currentLocationName,
            random: createSeededRandom(derive(seedOfWorld(data.metadata), 'atajo', about)),
        });
        if (!shortcut) return;
        data.metadata.locationMaps = applyShortcut(maps, shortcut);
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        const line = `Un camino de pastores acorta el viaje entre ${shortcut.from} y ${shortcut.to}: ${shortcut.days} día(s).`;
        noteDeed(line);
        toastr.info(line, 'Un atajo', { timeOut: 9000 });
        void postForModel(`[ATAJO] De paso, alguien menciona esto: ${line} Cuéntalo en una frase.`);
    });
}

/**
 * Z3: un edificio de aquí, con lo que se puede hacer dentro: «voy a la posada».
 *
 * @param {string} serviceId
 * @returns {void}
 */
export function openService(serviceId) {
    const card = buildServiceCards().find(c => c.id === serviceId);
    if (!card) return;
    const line = tellMoment('servicio', { servicio: serviceId });
    if (line) void postEngineLine(line);
    showHelpSections(card.label, [{
        title: 'Qué se puede hacer',
        items: card.actions.map(a => ({ label: a.label, detail: a.detail, key: a.enabled ? `service:${a.id}` : '' })),
    }]);
}

/**
 * Idea 85: mover la fortuna de un sitio, y contar si abre o cierra algo.
 *
 * @param {string} place
 * @param {number} delta
 * @returns {Promise<void>}
 */
export function shiftPlaceFortune(place, delta) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !place) return Promise.resolve();
    return worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const maps = data?.metadata?.locationMaps;
        if (!Array.isArray(maps)) return;
        const index = maps.findIndex((/** @type {any} */ l) => String(l?.name).toLowerCase() === place.toLowerCase());
        if (index < 0) return;
        const { location, change } = shiftFortune(maps[index], delta, servicesOf(maps[index]));
        maps[index] = location;
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        if (change) {
            noteDeed(change);
            toastr.info(change, place, { timeOut: 8000 });
            void postForModel(`[EL MUNDO CAMBIA] ${change} Que se note cuando el grupo pase por allí, sin inventar más.`);
        }
        if (isShellOpen()) refreshGameShell();
    });
}

/** @returns {boolean} Si aqui hay herreria: es donde se hacen los remedios (DL1). */
export function smithHere() {
    const here = hereLocation();
    return Boolean(here) && servicesOf(here).includes('herreria');
}

/** @returns {string[]} Donde hay herreria, para decirlo cuando aqui no la hay. */
export function smithPlaces() {
    return getCurrentWorldLocationMaps()
        .filter((/** @type {any} */ l) => servicesOf(l).includes('herreria'))
        .map((/** @type {any} */ l) => String(l.name));
}

/**
 * Los servicios de aqui, con lo que se puede hacer en cada uno, ya juzgado.
 *
 * @returns {ReturnType<typeof serviceActions>}
 */
export function buildServiceCards() {
    const location = hereLocation();
    if (!location || !chat_metadata) return [];
    const purse = partyPurse();
    const table = readRemedies();
    const remedies = partyMembers.flatMap(m => remediesFor(m, purse, table)
        .map(option => ({ id: option.injuryId, name: String(m.name), label: option.remedy.label, cost: option.remedy.cost })));
    const price = Number(currentUpkeepRules().healingPerDay) || 5;
    const cure = partyMembers.reduce((total, m) => {
        const cost = treatmentCost(m, price);
        return { gold: total.gold + cost.gold, days: Math.max(total.days, cost.days) };
    }, { gold: 0, days: 0 });
    const innkeeper = lastWorldNpcs.find(n => n.service === 'posada'
        && n.where.toLowerCase() === String(currentLocationName).toLowerCase())?.name ?? '';

    const cards = serviceActions({
        location,
        purse,
        partySize: partyMembers.length,
        fighting: combatEncounter.active,
        companions: partyMembers.slice(1).filter(m => !m.dead).map(m => ({ id: String(m.id), name: String(m.name) })),
        rumors: rumorsLeftHere(),
        innkeeper,
        remedies,
        cure,
        // Idea 135: lo que hay que llevar al templo.
        relics: (() => {
            const work = templeWork(partyMembers);
            return { unknown: work.unknown.length, cursed: work.cursed.length, identify: TEMPLE_PRICES.identify, lift: TEMPLE_PRICES.lift };
        })(),
    });
    // Idea 89: dia de fiesta, la comida corre a cuenta del pueblo.
    const feast = festivalHere();
    const innCard = cards.find(card => card.id === 'posada');
    const meal = innCard?.actions.find(a => a.id === 'inn-meal');
    if (feast && meal) Object.assign(meal, { cost: 0, enabled: !combatEncounter.active, label: 'Comer caliente (gratis: es fiesta)', detail: `Hoy es ${feast.name}.` });
    // Idea 129: el establo de la posada. Idea 128: los dados.
    if (innCard) {
        for (const [id, mount] of Object.entries(MOUNTS)) {
            innCard.actions.push({
                id: `inn-mount:${id}`, label: `Comprar ${id === 'mula' ? 'una mula' : 'un caballo'} (${mount.price} de oro)`,
                detail: `Para ir montados hace falta una por cabeza. Come ${mount.feedPerWeek} de oro de pienso a la semana.`,
                enabled: !combatEncounter.active && purse >= mount.price, cost: mount.price, target: id,
            });
        }
        const diceToday = roundsLeft(chat_metadata?.[DICE_GAME_KEY], currentLocationName, Math.max(1, campaignDay()));
        if (!diceToday.banned && diceToday.left > 0) {
            innCard.actions.push({
                id: 'inn-dice', label: `Jugar a los dados: a veintiuno (${diceToday.left} hoy)`,
                detail: 'Se apuesta, se piden dados y se suma. Quien se pasa de 21, pierde.',
                enabled: !combatEncounter.active && purse >= BETS[0], cost: 0,
            });
        }
    }
    // Idea 54: en los pueblos, quien enseña.
    if (hasMaster(location) && lastCompendium?.has?.('habilidades')) {
        /** @type {any[]} */
        const lessonActions = [];
        for (const member of partyMembers.filter(m => !m.dead)) {
            const className = String(/** @type {any} */ (member).charClass ?? /** @type {any} */ (member).class ?? '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            // R3/R4: quien enseña adelanta lo que tu clase aprendería más tarde (hasta dos
            // niveles), y a quien hace magia le enseña conjuros de su clase del grimorio. Lo
            // de tu nivel ya lo sabes: no se lo pagas a nadie.
            const level = Number(member.level) || 1;
            const now = new Set([
                ...abilitiesFor({ compendium: lastCompendium, className, level }).map((/** @type {any} */ a) => String(a.id)),
                ...spellsForClass({ className, level }),
            ]);
            // Y las técnicas de otros oficios: un maestro de armas enseña a quien pague.
            const crafts = lastCompendium.find('habilidades', { kind: 'habilidad' })
                .filter((/** @type {any} */ row) => row.when?.tree !== true && (Number(row.level) || 1) <= level + 2)
                .map(asAbility);
            const lessons = lessonsHere({
                candidates: [
                    ...crafts,
                    ...spellsForClass({ className, level: level + 2 }).map(id => grimoireAbilities().find(a => a.id === id)).filter(Boolean),
                ].filter((/** @type {any} */ a) => !now.has(String(a.id))),
                known: Array.isArray(member.abilities) ? member.abilities.map(String) : [],
                // La semilla del mundo y del sitio: el mismo maestro enseña siempre lo mismo.
                random: createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'maestro', String(currentLocationName))),
            });
            for (const lesson of lessons) {
                lessonActions.push({
                    id: `learn:${member.id}:${lesson.ability.id}`,
                    label: `${member.name}: aprender «${lesson.ability.name}» (${lesson.price} de oro, ${lesson.days} días)`,
                    detail: String(lesson.ability.description || ''),
                    enabled: !combatEncounter.active && purse >= lesson.price, cost: lesson.price, target: lesson.ability.id,
                });
            }
        }
        if (lessonActions.length > 0) cards.push({ id: 'maestro', label: 'Quien enseña', icon: 'fa-graduation-cap', actions: lessonActions.slice(0, 4) });
    }
    /** @param {'templo'|'herreria'} id @returns {any} */
    const cardOf = (id) => {
        if (!servicesOf(location).includes(id)) return null;
        let card = cards.find(c => c.id === id);
        if (!card) {
            card = { id, label: SERVICE_INFO[id].label, icon: SERVICE_INFO[id].icon, actions: [] };
            cards.push(card);
        }
        return card;
    };
    // Idea 58: en el templo se rehace quien quiera volver a elegir sus mejoras. Se paga al
    // confirmar: elegir puede acabar en no hacer nada.
    const temple = cardOf('templo');
    for (const member of temple ? partyMembers.filter(m => !m.dead) : []) {
        const cost = respecCost(member);
        if (cost <= 0) continue;
        temple.actions.push({
            id: `temple-respec:${member.id}`, label: `Rehacer a ${member.name}: volver a elegir sus mejoras (${cost} de oro)`,
            detail: purse < cost ? `No llega el oro: cuesta ${cost}.` : 'Se deshacen las que tiene y se eligen otras tantas, las que quiera.',
            enabled: !combatEncounter.active && purse >= cost, cost: 0, target: String(member.id),
        });
    }
    // Ideas 120 y 121: lo que el herrero hace con lo que traéis de caza.
    const smithy = cardOf('herreria');
    if (smithy) {
        const cloak = canCraft({ recipe: 'capa', party: partyMembers, purse });
        smithy.actions.push({
            id: 'craft:capa', label: `${RECIPES.capa.label} (${RECIPES.capa.gold} de oro y dos pieles)`,
            detail: cloak.reason || RECIPES.capa.note, enabled: !combatEncounter.active && cloak.ok, cost: 0,
        });
        for (const member of partyMembers.filter(m => !m.dead)) {
            const weapon = heldWeapon(member);
            if (!weapon) continue;
            const upgrade = canCraft({ recipe: 'mejora', party: partyMembers, purse, weapon });
            smithy.actions.push({
                id: `craft:mejora:${member.id}`,
                label: `Mejorar ${weapon.name} de ${member.name} (+1: ${RECIPES.mejora.gold} de oro y algo duro)`,
                detail: upgrade.reason || RECIPES.mejora.note, enabled: !combatEncounter.active && upgrade.ok, cost: 0, target: String(member.id),
            });
        }
    }
    // U8 del pegamento: el caso abierto, si queda algo por buscar aquí.
    const mystery = readCases(chat_metadata?.[CASES_KEY]);
    if (cluesHere(mystery, { place: currentLocationName }).length > 0) {
        cards.push({
            id: 'caso', label: 'El caso', icon: 'fa-magnifying-glass',
            actions: [{
                id: 'case-search', label: `Buscar pistas de «${mystery.active?.title}» aquí`,
                detail: 'Registrar el sitio y escuchar lo que se dice. Cuesta un rato del día; registrar pide Investigación.',
                enabled: !combatEncounter.active, cost: 0,
            }],
        });
    }
    // Idea 131: con un encargo entre manos, quien se alquila para él.
    if (innCard && chat_metadata?.[TAKEN_KEY]) {
        const hired = new Set(partyMembers.filter(m => m.guest).map(m => String(m.name)));
        const offers = hirelingsHere(createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mercenario', currentLocationName, String(campaignDay()))), Number(partyMembers[0]?.level) || 1);
        for (const offer of offers.filter(o => !hired.has(o.name))) {
            innCard.actions.push({
                id: `inn-merc:${offer.name}`, label: `Pagar a ${offer.name} (${offer.className}) para este encargo (${offer.fee} de oro)`,
                detail: 'Pega como uno más y, acabado el encargo, se va.', enabled: !combatEncounter.active && purse >= offer.fee, cost: offer.fee, target: offer.name,
            });
        }
    }
    // Idea 113: las cartas que esperan, se recogen en la posada.
    if (innCard) {
        for (const letter of readLetters(chat_metadata?.[LETTERS_KEY]).slice(0, 2)) {
            innCard.actions.push({
                id: `inn-letter:${letter.id}`, label: `Leer la carta de ${letter.from}`,
                detail: 'Os la guardaban en la posada.', enabled: !combatEncounter.active, cost: 0, target: letter.id,
            });
        }
    }
    // Ideas 118, 126, 127 y 134: la tienda.
    if (servicesOf(location).includes('tienda')) {
        const shop = shopHere();
        const hero = partyMembers[0];
        const junk = junkOf(partyMembers);
        const sellable = partyMembers.flatMap(m => (m.items ?? []).filter((/** @type {any} */ i) => canSell(i, m))
            .map((/** @type {any} */ i) => ({ member: m, item: i, price: sellPrice(i) })))
            .filter(x => !junk.some(j => j.itemId === String(x.item.id)))
            .sort((a, b) => b.price - a.price)
            .slice(0, 2);
        /** @type {any[]} */
        const shopActions = shop.stock.map(offer => ({
            id: `shop-buy:${offer.name}`,
            label: `${offer.name} (${offer.price} de oro)`,
            detail: offer.reasons.length > 0 ? `Precio de hoy: ${offer.reasons.join(' · ')}` : 'Al precio de siempre.',
            enabled: !combatEncounter.active && Boolean(hero) && purse >= offer.price,
            cost: offer.price,
            target: offer.name,
        }));
        if (junk.length > 0) {
            const total = junk.reduce((sum, j) => sum + j.price, 0);
            shopActions.push({
                id: 'shop-junk', label: `Vender la chatarra (${junk.length} ${junk.length === 1 ? 'cosa' : 'cosas'}, ${total} de oro)`,
                detail: junk.map(j => j.name).slice(0, 6).join(', '), enabled: !combatEncounter.active, cost: 0,
            });
        }
        for (const sale of sellable) {
            shopActions.push({
                id: `shop-sell:${sale.member.id}:${sale.item.id}`, label: `Vender ${sale.item.name} (${sale.price} de oro)`,
                detail: `Lo lleva ${sale.member.name}.`, enabled: !combatEncounter.active, cost: 0,
            });
        }
        // Idea 96: llevarse lo más barato sin pagar, si se atreve alguien.
        const cheapest = [...shop.stock].sort((a, b) => a.price - b.price)[0];
        if (cheapest) {
            shopActions.push({
                id: `shop-steal:${cheapest.name}`, label: `Llevarse ${cheapest.name} sin pagar (Juego de manos, CD ${stealDC(String(location?.locationType ?? location?.type ?? ''))})`,
                detail: 'Si os pillan, multa del doble, y aquí os apuntan.', enabled: !combatEncounter.active, cost: 0, target: String(cheapest.price),
            });
        }
        if (!shop.triedToday) {
            shopActions.push({
                id: 'shop-haggle', label: 'Regatear: tres rondas con el tendero',
                detail: 'Una vez al día en cada tienda. Si cede, un 20 % menos hoy; a medias, un 10 %.', enabled: !combatEncounter.active, cost: 0,
            });
        }
        shopActions.push({ id: 'shop-prices', label: '¿Por qué estos precios?', detail: 'Lo que sube y lo que baja, parte a parte.', enabled: true, cost: 0 });
        // Idea 125: quien presta, con ventanilla. Una deuda a la vez.
        const debt = getDebt();
        if (!debt) {
            for (const amount of LOAN.amounts) {
                shopActions.push({
                    id: `lend:${amount}`, label: `Pedir prestados ${amount} de oro`,
                    detail: `Hay que devolver ${Math.ceil(amount * (1 + LOAN.interest))} en ${LOAN.days} días.`,
                    enabled: !combatEncounter.active, cost: 0, target: String(amount),
                });
            }
        } else if (!debt.contractId) {
            shopActions.push({
                id: 'repay', label: `Devolver lo que debéis (${debt.owed} de oro)`, detail: `A ${debt.patronName}.`,
                enabled: !combatEncounter.active && purse >= debt.owed, cost: 0,
            });
        }
        cards.push({ id: 'tienda', label: 'La tienda', icon: 'fa-shop', actions: shopActions });
    }

    // Idea 26: en la posada se busca compañia. Primero se conoce, luego se pide.
    const inn = cards.find(card => card.id === 'posada');
    if (inn) {
        // Idea 42: con el grupo lleno, el nuevo se va a casa.
        inn.actions.push(...recruitActions(currentRecruits(), {
            bench: true,
            fighting: combatEncounter.active, purse, partySize: partyMembers.length,
        }));
    }
    return cards;
}

/**
 * Ideas 120 y 121: el herrero convierte lo cazado en algo: una capa de pieles, o el arma a +1.
 *
 * @param {string} actionId `craft:capa` o `craft:mejora:<id>`.
 */
function craftAtSmith(actionId) {
    const [, recipe, memberId] = actionId.split(':');
    const member = recipe === 'mejora' ? partyMembers.find(m => String(m.id) === memberId) : partyMembers[0];
    const weapon = recipe === 'mejora' && member ? heldWeapon(member) : null;
    const plan = canCraft({ recipe, party: partyMembers, purse: partyPurse(), weapon });
    if (!plan.ok || !member) {
        toastr.warning(plan.reason || 'No se puede.', 'La herrería');
        return;
    }
    if (!payFromParty(plan.gold)) {
        toastr.warning(`No llega el oro: cuesta ${plan.gold}.`);
        return;
    }
    for (const used of plan.use) {
        const owner = partyMembers.find(m => String(m.id) === used.memberId);
        if (owner) removeItemFromInventory(/** @type {any} */ (owner), used.itemId);
    }
    const spent = plan.use.map(u => u.name).join(', ');
    let line = '';
    if (recipe === 'capa') {
        addItemToInventory(/** @type {any} */ (member), createItem(/** @type {any} */ (cloakItem())));
        line = `El herrero cose una capa de pieles para ${member.name} (${plan.gold} de oro, ${spent}).`;
    } else if (weapon) {
        Object.assign(weapon, upgradedWeapon(weapon));
        line = `El herrero mejora el arma de ${member.name}: ahora es ${weapon.name} (${plan.gold} de oro, ${spent}).`;
    }
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`⚒️ [HERRERÍA] ${line}`);
    toastr.success(line, 'La herrería');
}

/**
 * Hacer algo en un servicio de aqui.
 *
 * @param {string} actionId
 * @returns {Promise<string>}
 */
export async function runService(actionId) {
    const action = buildServiceCards().flatMap(card => card.actions).find(a => a.id === actionId);
    if (!action || !action.enabled) {
        toastr.warning(action?.detail || 'Eso no se puede hacer aquí ahora.');
        return '';
    }
    // Los remedios se cobran solos, en `buyRemedy`: no se paga dos veces.
    const smith = actionId.startsWith('smith:');
    if (!smith && action.cost > 0 && !payFromParty(action.cost)) {
        toastr.warning(`No llega el oro: cuesta ${action.cost}.`);
        return '';
    }

    if (actionId === 'inn-common') await takeRest('corto');
    else if (actionId === 'inn-room') await takeRest('largo');
    else if (actionId === 'inn-meal') {
        for (const member of partyMembers) {
            member.needs = relieve(member, 'ate');
            member.needs = relieve(member, 'drank');
        }
        postCombatNarration(`🍲 [POSADA] Comida caliente para todos (${action.cost} de oro).`);
    } else if (actionId.startsWith('inn-round:')) {
        const member = partyMembers.find(m => String(m.id) === String(action.target));
        if (member) {
            // Idea 40: de qué se habla. Si toca lo que busca, cuenta como escena de confidente.
            const body = $('<div class="tr-setback"></div>');
            body.append($('<h3></h3>').text(`Una ronda con ${member.name}`));
            body.append($('<p></p>').text('¿De qué le preguntas?'));
            const ids = Object.keys(TOPICS);
            const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
                okButton: false, cancelButton: false,
                customButtons: ids.map((id, i) => ({ text: TOPICS[/** @type {keyof typeof TOPICS} */ (id)].label, result: 70 + i, classes: [`rt-${id}`] })),
            }).show();
            const topic = ids[Number(picked) - 70] ?? 'pasado';
            const hits = topicHits(topic, readReasons(member).wants);
            recordCampaignBondEvent(String(member.id), hits ? 'confidant_scene' : 'shared_downtime');
            advanceCampaignSlot();
            if (hits) toastr.success(`Le toca de cerca: ${member.name} se abre.`, 'La ronda');
            const shared = lastMemoryWith(chat_metadata?.[MEMORIES_KEY], String(member.name));
            await postForModel(roundPrompt({ member, topic, place: currentLocationName, shared }));
        }
    } else if (actionId.startsWith('inn-letter:')) await readLetter(String(action.target));
    else if (actionId.startsWith('shop-buy:')) {
        const hero = partyMembers[0];
        if (hero) {
            hero.items = hero.items ?? [];
            addItemToInventory(/** @type {any} */ (hero), createItem(/** @type {any} */ (describeLootItem(String(action.target)))));
            savePartyState();
            postCombatNarration(`🛒 [TIENDA] ${hero.name} compra ${action.target} por ${action.cost} de oro.`);
        }
    } else if (actionId === 'shop-junk') sellItems(junkOf(partyMembers));
    else if (actionId.startsWith('shop-steal:')) stealItem(actionId.slice('shop-steal:'.length), Number(action.target) || 0);
    else if (actionId.startsWith('inn-merc:')) hireMercenary(String(action.target));
    else if (actionId.startsWith('shop-sell:')) {
        const [, memberId, itemId] = actionId.split(':');
        const member = partyMembers.find(m => String(m.id) === memberId);
        const item = (member?.items ?? []).find((/** @type {any} */ i) => String(i.id) === itemId);
        if (member && item) sellItems([{ memberId, itemId, name: String(item.name), price: sellPrice(item) }]);
    } else if (actionId === 'case-search') await searchCaseHere();
    else if (actionId === 'shop-haggle') await haggle();
    else if (actionId === 'shop-prices') {
        const shop = shopHere();
        const said = shop.reasons.length > 0 ? shop.reasons.join('\n') : 'Hoy, al precio de siempre: ni el sitio está caro ni os tratan distinto.';
        void Popup.show.text('Los precios de hoy', said);
    } else if (actionId.startsWith('inn-meet:')) await meetRecruit(String(action.target));
    else if (actionId.startsWith('inn-hire:')) await hireRecruit(String(action.target));
    else if (actionId === 'inn-rumor') await hearRumor();
    else if (actionId === 'inn-talk') startTalk(String(action.target));
    else if (smith) {
        const [, injuryId, name] = actionId.split(':');
        const member = partyMembers.find(m => String(m.name) === name);
        if (member) buyRemedy(member, injuryId);
    } else if (actionId === 'temple-cure') {
        for (const member of partyMembers) {
            const patch = healInjuries(member, 9999);
            member.injuries = patch.injuries;
            member.baseStats = patch.baseStats;
            Object.assign(member, patch.stats);
        }
        await postForModel(`[TEMPLO] En el templo de ${currentLocationName} os cosen y os vendan (${action.cost} de oro). `
            + 'Las heridas que se curan con tiempo quedan cerradas. Cuéntalo en dos frases.');
    } else if (actionId === 'temple-identify') {
        // Idea 135: se mira cada cosa; lo maldito se dice.
        /** @type {string[]} */
        const said = [];
        for (const { memberId, itemId } of templeWork(partyMembers).unknown) {
            const member = partyMembers.find(m => String(m.id) === memberId);
            const index = (member?.items ?? []).findIndex((/** @type {any} */ i) => String(i.id) === itemId);
            if (!member || index < 0) continue;
            const seen = identify(/** @type {any} */ (member.items)[index]);
            /** @type {any} */ (member.items)[index] = seen.item;
            said.push(seen.line);
        }
        postCombatNarration(`🔎 [TEMPLO] ${said.join(' ')}`);
        void Popup.show.text('Lo que traéis', said.join('\n'));
    } else if (actionId === 'temple-lift') {
        /** @type {string[]} */
        const freed = [];
        for (const { memberId, itemId } of templeWork(partyMembers).cursed) {
            const member = partyMembers.find(m => String(m.id) === memberId);
            const index = (member?.items ?? []).findIndex((/** @type {any} */ i) => String(i.id) === itemId);
            if (!member || index < 0) continue;
            freed.push(String(/** @type {any} */ (member.items)[index].name));
            /** @type {any} */ (member.items)[index] = liftCurse(/** @type {any} */ (member.items)[index]);
            syncCurse(member);
        }
        postCombatNarration(`🕯️ [TEMPLO] Quitan la maldición: ${freed.join(', ')}. Ya se puede soltar.`);
    } else if (actionId.startsWith('inn-mount:')) {
        // Idea 129: ya está pagada; al establo.
        if (chat_metadata) chat_metadata[MOUNTS_KEY] = addMount(chat_metadata[MOUNTS_KEY], String(action.target));
        postCombatNarration(`🐴 [POSADA] En el establo: ${describeMounts(chat_metadata?.[MOUNTS_KEY])}.`);
    } else if (actionId === 'inn-dice') await playTavernDice();
    else if (actionId.startsWith('temple-respec:')) await respecMember(String(action.target));
    else if (actionId.startsWith('craft:')) craftAtSmith(actionId);
    else if (actionId.startsWith('learn:')) {
        const [, memberId, abilityId] = actionId.split(':');
        await learnAbility(memberId, abilityId);
    } else if (actionId.startsWith('lend:')) {
        // Idea 125: pedir prestado porque se quiere.
        const lent = borrow({ amount: Number(action.target), today: Math.max(1, campaignDay()), here: currentLocationName, debt: getDebt() });
        const holder = partyMembers.find(m => !m.dead) ?? partyMembers[0];
        if (lent.debt && holder && chat_metadata) {
            chat_metadata[DEBT_KEY] = lent.debt;
            holder.gold = (Number(holder.gold) || 0) + lent.debt.amount;
            noteDeed(`${lent.debt.patronName} os prestó ${lent.debt.amount} de oro.`);
            void postForModel(`💰 [CAMPAÑA] ${lent.line}`);
            toastr.info(lent.line, 'Préstamo', { timeOut: 10000 });
        } else toastr.warning(lent.line);
    } else if (actionId === 'repay') {
        const paid = repay(getDebt(), partyPurse());
        if (paid.ok && payFromParty(paid.pay) && chat_metadata) {
            delete chat_metadata[DEBT_KEY];
            noteDeed(paid.line);
            postCombatNarration(`💰 [CAMPAÑA] ${paid.line}`);
            toastr.success(paid.line, 'Deuda saldada', { timeOut: 10000 });
        } else toastr.warning(paid.line);
    } else if (actionId === 'board') await openGuild();

    savePartyState();
    saveMetadata();
    renderPartyMembers();
    if (isShellOpen()) refreshGameShell();
    return action.label;
}

/**
 * Idea 96: intentar llevarse algo de la tienda sin pagar. Juego de manos contra la
 * vigilancia del sitio; si os pillan, multa y os apuntan.
 *
 * @param {string} name
 * @param {number} price
 * @returns {string}
 */
function stealItem(name, price) {
    if (!chat_metadata) return '';
    const here = hereLocation();
    const thief = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'sleight').modifier > skillModifier(top, 'sleight').modifier ? m : top), null);
    if (!thief) return '';
    const roll = rollCheck({ member: thief, skill: 'sleight', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: stealDC(String(here?.locationType ?? here?.type ?? '')) });
    if (!roll) return '';
    postCombatNarration(roll.said);
    const outcome = stealOutcome({ success: roll.success, price, place: currentLocationName, wanted: chat_metadata[WANTED_KEY] });
    chat_metadata[WANTED_KEY] = outcome.wanted;
    // R9: si os pillan, quien manda aquí lo sabe.
    if (!outcome.free) void nudgeRuler(currentLocationName, 'crimen');
    if (outcome.free) {
        addItemToInventory(/** @type {any} */ (thief), createItem(/** @type {any} */ (describeLootItem(name, '', worldItemCatalogue))));
    } else if (!payFromParty(outcome.fine)) {
        for (const member of partyMembers) member.gold = 0;
    }
    savePartyState();
    saveMetadata();
    postCombatNarration(`🫳 [TIENDA] ${thief.name} intenta llevarse ${name}. ${outcome.line}`);
    toastr[outcome.free ? 'success' : 'error'](outcome.line, 'Robar');
    void postForModel(`[ROBO] ${thief.name} intenta llevarse ${name} de la tienda de ${currentLocationName}. ${outcome.line} Cuéntalo en dos frases.`);
    // Idea 28: y a los tuyos les parece lo que sea.
    judgeDecision('robar');
    if (isShellOpen()) refreshGameShell();
    return outcome.line;
}

/** @returns {number} Los rumores que quedan por oir aqui. */
export function rumorsLeftHere() {
    const heard = Array.isArray(chat_metadata?.[RUMORS_HEARD_KEY]) ? chat_metadata[RUMORS_HEARD_KEY] : [];
    return lastRumors.filter(r => r.where.toLowerCase() === String(currentLocationName).toLowerCase()
        && !heard.includes(r.id)).length;
}

/**
 * Comprar el remedio de una herida que no cura.
 *
 * @param {any} member
 * @param {string} injuryId
 * @returns {string}
 */
export function buyRemedy(member, injuryId) {
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    if (!smithHere()) {
        toastr.warning('Esto lo hace un herrero: hay que estar donde haya uno.');
        return '';
    }
    const table = readRemedies();
    const remedy = table[injuryId];
    const patch = applyRemedy(member, injuryId, table);
    if (!remedy || !patch) {
        toastr.warning('Esa herida no tiene remedio, o ya no la tiene.');
        return '';
    }
    if (!payFromParty(remedy.cost)) {
        toastr.warning(`No llega el oro: cuesta ${remedy.cost}.`);
        return '';
    }

    member.injuries = patch.injuries;
    member.baseStats = patch.baseStats;
    Object.assign(member, patch.stats);
    savePartyState();
    renderPartyMembers();

    const line = remedy.becomes
        ? `${member.name} estrena ${remedy.label.toLowerCase()} (${remedy.cost} de oro). Ahora: ${String(remedy.becomes.label).toLowerCase()}.`
        : `${member.name}: ${remedy.label.toLowerCase()} (${remedy.cost} de oro). La herida se cierra del todo.`;
    // Al narrador, que es quien tiene que saber que Bruna ahora lleva pierna de palo.
    void postForModel(`🦿 [CAMPAÑA] ${line}`);
    toastr.success(line, 'Remedio');
    return line;
}

/**
 * Idea 128: a veintiuno, en la taberna. Se apuesta, se piden dados, se planta; y quien tenga
 * buenas manos puede hacer trampa una vez.
 *
 * @returns {Promise<void>}
 */
async function playTavernDice() {
    if (!chat_metadata) return;
    const today = Math.max(1, campaignDay());
    const hero = partyMembers.find(m => !m.dead) ?? partyMembers[0];
    const left = roundsLeft(chat_metadata[DICE_GAME_KEY], currentLocationName, today);
    if (!hero || left.banned || left.left <= 0) {
        toastr.info(left.banned ? 'Aquí ya os conocen: hoy no os dejan jugar.' : 'Por hoy ya está bien de dados.');
        return;
    }
    const betBox = $('<div class="td-root"></div>');
    betBox.append($('<h3></h3>').text('A veintiuno'));
    betBox.append($('<p></p>').text('Se tiran dados y se suman. Quien se pasa de 21, pierde; al plantarte, la casa tira hasta 17.'));
    const purse = partyPurse();
    const bet = await new Popup(betBox[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: 'Mejor no',
        customButtons: BETS.filter(b => purse >= b).map(b => ({ text: `Apostar ${b}`, result: 100 + b, classes: ['td-bet'] })),
    }).show();
    if (typeof bet !== 'number' || bet < 100) return;
    let game = startGame(bet - 100, nextRandom);
    while (game.state === 'playing') {
        const table = $('<div class="td-root"></div>');
        table.append($('<h3></h3>').text('A veintiuno'));
        table.append($('<p class="td-table"></p>').text(describeGame(game)));
        const choice = await new Popup(table[0], POPUP_TYPE.TEXT, '', {
            okButton: false,
            cancelButton: false,
            customButtons: [
                { text: 'Otro dado', result: 61, classes: ['td-draw'] },
                { text: 'Plantarse', result: 62, classes: ['td-stand'] },
                ...(game.cheated ? [] : [{ text: 'Hacer trampa (Juego de manos)', result: 63, classes: ['td-cheat'] }]),
            ],
        }).show();
        if (choice === 61) game = drawDie(game, nextRandom);
        else if (choice === 63) {
            const trick = rollCheck({ member: hero, skill: 'sleight', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: 14 });
            if (trick) postCombatNarration(trick.said);
            game = cheat(game, { total: Number(trick?.total) || 0 });
        } else game = stand(game, nextRandom);
    }
    const money = payout(game);
    if (money > 0) hero.gold = (Number(hero.gold) || 0) + money;
    else if (money < 0) payFromParty(-money);
    const before = chat_metadata[DICE_GAME_KEY];
    const same = before && before.place === currentLocationName && Number(before.day) === today;
    chat_metadata[DICE_GAME_KEY] = {
        place: currentLocationName, day: today,
        played: (same ? Number(before.played) || 0 : 0) + 1,
        banned: game.state === 'caught' || Boolean(same && before.banned),
    };
    countStat('gold', Math.max(0, money));
    saveMetadata();
    savePartyState();
    postCombatNarration(`🎲 [TABERNA] ${hero.name} juega a veintiuno. ${describeGame(game)}`);
    const result = $('<div class="td-root"></div>');
    result.append($('<h3></h3>').text(game.state === 'won' ? 'Ganáis' : game.state === 'push' ? 'Empate' : 'Perdéis'));
    result.append($('<p class="td-table"></p>').text(describeGame(game)));
    await new Popup(result[0], POPUP_TYPE.TEXT, '', { okButton: 'Vale' }).show();
}
