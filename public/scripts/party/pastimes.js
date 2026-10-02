/**
 * Trabajos y ratos libres, en el juego (J14.11 de wiki/ROADMAP_SIN_CONEXION.md): servir mesas,
 * echar una mano en la forja, las cartas, leer en el gremio, pescar en el muelle y entrenar en el
 * patio del gremio.
 *
 * Las reglas están en el motor (`campaign/pastimes.js` y `campaign/card-game.js`) y la pantalla
 * en `ui/pastime-scene.js`. Esto los junta con la partida:
 *
 * - **Qué se ofrece**: la pantalla del pueblo pide, por cada sitio, sus trabajos y ratos
 *   (`withPastimes`, que se añade a lo que da `townNow`), y el muelle de un puerto, que antes
 *   no tenía tarjeta.
 * - **Jugarlo**: quién de tu grupo está libre, la escena con quien lleva el sitio y, al acabar,
 *   el oro, el rumor, la experiencia, el pescado o la mejora del arma; el aprecio de quien lleva
 *   el sitio (`attitudes`) y un poco de vínculo con quien vino (`pastime_together`).
 * - **El reloj**: gasta la parte del día (comprar no: D-J31), con su nombre en la cabecera.
 *   Dejarlo a medias no gasta nada.
 *
 * Lo que dura de un día a otro (los días de forja de cada herrero) va en
 * `chat_metadata.pastimes`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import {
    PASTIMES, PASTIMES_KEY, HELPER_GOLD, readPastimes, pastimeOffers, docksPlace, pastimeScene, choiceOf, pastimeOutcome,
    pastimeLog, sayList,
} from '../game-engine/campaign/pastimes.js';
import { cardsNet } from '../game-engine/campaign/card-game.js';
import { renderScene } from '../game-engine/campaign/meetups.js';
import { HEALING_AT } from '../game-engine/campaign/whereabouts.js';
import { normalizeCalendar, getElapsedSlots } from '../game-engine/campaign/calendar.js';
import { shiftAttitude, describeAttitude } from '../game-engine/campaign/attitudes.js';
import { FAVOR_ATTITUDE, HOME_FAVORS } from '../game-engine/campaign/companion-arcs.js';
import { upgradedWeapon } from '../game-engine/campaign/trophies.js';
import { weaponOf } from '../game-engine/rules/equipment.js';
import { relieve } from '../game-engine/rules/needs.js';
import { topLevel } from '../game-engine/campaign/guild-training.js';
import { readGuild } from '../game-engine/campaign/guild.js';
import { HUB_HEROES_KEY, readRestingHeroes } from '../game-engine/campaign/hub-heroes.js';
import { openPastime } from '../game-engine/ui/pastime-scene.js';
import { openPack, pastimePlace } from '../game-engine/ui/pixel-art.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { ATTITUDES_KEY } from './keys.js';
import { combatEncounter, currentLocationName, partyMembers } from './state.js';
import { lastHub, lastWorldNpcs } from './world.js';
import { campaignDay, getCampaignCalendar, recordCampaignBondEvent, spendDayPart } from './time.js';
import { partyPurse, payFromParty, renderPartyMembers, savePartyState } from './roster.js';
import { postCombatNarration } from './narration.js';
import { hearRumor } from './town.js';
import { peopleHere } from './social.js';
import { getGuild } from './contracts.js';
import { canLevelUp } from './level-up.js';
import { nextRandom } from './combat-rules.js';
import { countStat } from './menus.js';
import { refreshWorldMemoryPrompt } from './world-growth.js';

/** @typedef {import('../game-engine/campaign/town.js').TownPlace} TownPlace */
/** @typedef {keyof typeof PASTIMES} PastimeId */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {string} name @returns {string} */
const firstName = (name) => text(name).split(' ')[0] || text(name);

// ---------------------------------------------------------------------------------------
// Lo guardado y lo de ahora.

/** @returns {{forge: Record<string, number>}} */
function saved() {
    return readPastimes(chat_metadata?.[PASTIMES_KEY]);
}

/** @param {{forge: Record<string, number>}} state */
function save(state) {
    if (!chat_metadata) return;
    chat_metadata[PASTIMES_KEY] = readPastimes(state);
    saveMetadata();
}

/** @returns {{id: string, label: string, advancesDay: boolean}} La parte del día de ahora. */
function slotNow() {
    const c = normalizeCalendar(getCampaignCalendar());
    return c.slots[c.slotIndex] ?? c.slots[0];
}

/**
 * El azar de un trabajo, con la semilla del mundo y la parte del día: la misma partida da lo
 * mismo dos veces (las cartas, no: se barajan con el azar del juego).
 *
 * @param {...any} parts
 * @returns {() => number}
 */
function seeded(...parts) {
    return createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'trabajos', ...parts.map(p => String(p)), getElapsedSlots(getCampaignCalendar())));
}

/** @returns {any} Tu héroe: el primero que no es invitado y sigue en pie. */
function heroNow() {
    return partyMembers.find(m => !m.guest && !m.dead) ?? partyMembers.find(m => !m.dead) ?? partyMembers[0] ?? null;
}

/** @returns {number} El nivel de la biblioteca del gremio, en el gremio. */
function libraryLevel() {
    if (!lastHub) return 0;
    return Math.max(0, Math.floor(Number(getGuild()?.buildings?.library) || 0));
}

/** @returns {string} La campaña de aquí, para los retratos y el escenario. */
function packNow() {
    return openPack(() => { if (isShellOpen()) refreshGameShell(); }) || (lastHub ? 'gremio' : '');
}

/**
 * Tu gente libre ahora, para venir: la de tu grupo que anda por el pueblo. Quien va mal de vida
 * está en el templo curándose, y no viene.
 *
 * @returns {Array<{key: string, name: string, member: any}>}
 */
function freeMates() {
    return peopleHere().people
        .filter(p => p.inParty && p.source && !p.source.dead)
        .filter(p => {
            const max = Number(p.source.maxHp) || 0;
            return !(max > 0 && (Number(p.source.hp) || 0) / max < HEALING_AT);
        })
        .map(p => ({ key: p.key, name: p.name, member: p.source }));
}

/**
 * La primera arma del grupo que el herrero puede mejorar: la de tu héroe, si puede; si no, la de
 * otro.
 *
 * @returns {{member: any, weapon: any}|null}
 */
function upgradeable() {
    const hero = heroNow();
    const order = [hero, ...partyMembers.filter(m => m !== hero && !m.dead)];
    for (const member of order) {
        if (!member) continue;
        const weapon = weaponOf(member);
        if (weapon && (Number(weapon.magicalBonus) || 0) < 1) return { member, weapon };
    }
    return null;
}

// ---------------------------------------------------------------------------------------
// Lo que ve la pantalla del pueblo.

/**
 * Los trabajos y ratos de un sitio, como acciones de la pantalla del pueblo.
 *
 * @param {TownPlace} place
 * @returns {Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, run: () => void}>}
 */
export function pastimeActs(place) {
    if (!chat_metadata || !partyMembers[0] || !place) return [];
    const keeper = text(place.keeper?.name);
    const offers = pastimeOffers({
        place,
        slot: slotNow().id,
        fighting: Boolean(combatEncounter.active),
        purse: partyPurse(),
        forgeSteps: keeper ? saved().forge[keeper] ?? 0 : 0,
        library: libraryLevel(),
        // El patio de entrenamiento es el del gremio, en casa.
        yard: Boolean(lastHub),
    });
    return offers.map(offer => ({
        id: `rato:${offer.id}`,
        label: offer.label,
        icon: offer.icon,
        detail: offer.detail,
        enabled: offer.enabled,
        run: () => { void playPastime(offer.id, place); },
    }));
}

/**
 * Lo que da `townNow`, con los trabajos y ratos de cada sitio (`pastimes`) y el muelle de un
 * puerto (`extraPlaces`), que la pantalla del pueblo añade a sus sitios.
 *
 * @template T
 * @param {T} data
 * @returns {T}
 */
export function withPastimes(data) {
    const location = /** @type {any} */ (data)?.location;
    if (!location) return data;
    const docks = docksPlace({ location, hub: Boolean(lastHub) });
    return /** @type {T} */ ({
        ...data,
        extraPlaces: docks ? [docks] : [],
        pastimes: (/** @type {TownPlace} */ place) => pastimeActs(place),
    });
}

// ---------------------------------------------------------------------------------------
// Jugarlo.

/**
 * Subir el aprecio de quien lleva el sitio: un paso, uno por persona y día (`attitudes.js`). Si
 * llega a lo que abre su favor, se dice.
 *
 * @param {string} name
 * @param {string} kind La clase del sitio (`posada`, `herreria`).
 * @returns {string[]}
 */
function warmKeeper(name, kind) {
    const npc = lastWorldNpcs.find(n => text(n.name).toLowerCase() === text(name).toLowerCase());
    if (!chat_metadata || !npc) return [];
    const result = shiftAttitude(chat_metadata[ATTITUDES_KEY], { name: npc.name, delta: 1, day: campaignDay() });
    if (!result.ok) return [];
    chat_metadata[ATTITUDES_KEY] = result.state;
    saveMetadata();
    refreshWorldMemoryPrompt();
    const lines = [`${firstName(npc.name)} os mira ahora de forma ${describeAttitude(result.value)}.`];
    const favor = /** @type {Record<string, {favor: string}>} */ (HOME_FAVORS)[kind];
    if (result.value === FAVOR_ATTITUDE && favor) lines.push(`Con ese aprecio, ${firstName(npc.name)} os hace un favor: ${favor.favor}.`);
    return lines;
}

/**
 * Lo que da un trabajo o un rato, aplicado a la partida, y lo que se cuenta.
 *
 * @param {PastimeId} id
 * @param {Object} input
 * @param {TownPlace} input.place
 * @param {string} input.choice
 * @param {any[]} input.mates Las fichas de quien vino.
 * @param {import('../game-engine/campaign/card-game.js').CardGame|null} input.game
 * @returns {Promise<{lines: string[], gold: number, net: number}>}
 */
async function settle(id, { place, choice, mates, game }) {
    const hero = heroNow();
    const keeper = text(place.keeper?.name);
    /** @type {string[]} */
    const lines = [];
    let gold = 0;
    let net = 0;

    if (id === 'cartas') {
        net = game ? cardsNet(game) : 0;
        if (net > 0 && hero) hero.gold = (Number(hero.gold) || 0) + net;
        else if (net < 0) payFromParty(Math.min(-net, partyPurse()));
        if (net > 0) countStat('gold', net);
        lines.push(net > 0 ? `Ganas ${net} de oro.` : net < 0 ? `Pierdes ${-net} de oro.` : 'Ni ganas ni pierdes.');
        if (mates.length > 0) lines.push(`${sayList([...mates.map(m => firstName(m.name)), 'tú'])}, un poco más cerca.`);
    } else {
        let picked = choice;
        /** @type {string[]} */
        const heard = [];
        // Con la oreja puesta: el rumor de verdad, el de `/rumor`. Si ya no queda ninguno, propinas.
        if (id === 'mesas' && picked === 'rumor') {
            const rumor = await hearRumor();
            if (rumor) heard.push(`Lo que se oye en las mesas: ${rumor}`);
            else {
                picked = 'propinas';
                heard.push('Hoy no se cuenta nada que no sepas: te quedas con las propinas.');
            }
        }
        const target = id === 'forja' ? upgradeable() : null;
        const forge = saved();
        // El patio: quien va por detrás del más avanzado de los tuyos (también de los que descansan
        // en el gremio) aprende el doble, y cada maestro de armas en casa suma (`guild-training.js`).
        let top = 1;
        let masters = 0;
        if (id === 'patio') {
            const worldName = String(chat_metadata?.[METADATA_KEY] || '');
            const data = worldName ? await loadWorldInfo(worldName).catch(() => null) : null;
            top = topLevel(partyMembers, readRestingHeroes(data?.metadata?.[HUB_HEROES_KEY]));
            masters = readGuild(getGuild()).staff.filter(person => person.role === 'maestro').length;
        }
        const outcome = pastimeOutcome(id, {
            choice: picked,
            hero,
            companions: mates,
            random: seeded(id, 'lo-que-da'),
            forgeSteps: keeper ? forge.forge[keeper] ?? 0 : 0,
            canUpgrade: Boolean(target),
            library: libraryLevel(),
            partySize: partyMembers.filter(m => !m.dead).length,
            top,
            masters,
        });
        gold = outcome.gold;
        if (gold > 0 && hero) {
            hero.gold = (Number(hero.gold) || 0) + gold;
            countStat('gold', gold);
        }
        for (const gain of outcome.xp) {
            const member = partyMembers.find(m => String(m.id) === gain.id);
            if (member) member.xp = (Number(member.xp) || 0) + gain.amount;
        }
        if (outcome.eat) {
            for (const member of partyMembers.filter(m => !m.dead)) member.needs = relieve(member, 'ate');
        }
        lines.push(...outcome.lines);
        lines.push(...heard);
        if (id === 'forja' && keeper) {
            save({ forge: { ...forge.forge, [keeper]: outcome.forgeSteps } });
            if (outcome.upgrade && target) {
                Object.assign(target.weapon, upgradedWeapon(target.weapon));
                lines.push(target.member === hero
                    ? `${firstName(keeper)} trabaja tu arma sin cobrarte: ahora es ${target.weapon.name}.`
                    : `${firstName(keeper)} trabaja el arma de ${firstName(target.member.name)} sin cobrar: ahora es ${target.weapon.name}.`);
            }
        }
        if (outcome.keeperLikes && keeper) lines.push(...warmKeeper(keeper, place.kind));
        for (const gain of outcome.xp) {
            const member = partyMembers.find(m => String(m.id) === gain.id);
            if (member && canLevelUp(member)) lines.push(`${firstName(member.name)} ya puede subir de nivel.`);
        }
    }
    for (const mate of mates) {
        if (mate?.id !== undefined && mate?.id !== null) recordCampaignBondEvent(String(mate.id), 'pastime_together');
    }
    savePartyState();
    renderPartyMembers();
    return { lines, gold, net };
}

/**
 * Hacer un trabajo o un rato en un sitio del pueblo: quién viene, la escena, lo que da y la
 * parte del día que se va.
 *
 * @param {PastimeId} id
 * @param {TownPlace} place
 * @returns {Promise<string>} Lo que se cuenta, o vacío si se dejó.
 */
export async function playPastime(id, place) {
    if (!chat_metadata || !partyMembers[0] || !place) return '';
    const offer = pastimeActs(place).find(a => a.id === `rato:${id}`);
    if (!offer?.enabled) {
        if (offer?.detail) toastr.info(offer.detail, PASTIMES[id]?.label ?? 'Un rato');
        return '';
    }
    const spec = PASTIMES[id];
    const hero = heroNow();
    const slot = slotNow();
    const keeper = text(place.keeper?.name);
    const free = freeMates();
    const pack = packNow();
    /** @type {{lines: string[], gold: number, net: number}} */
    let told = { lines: [], gold: 0, net: 0 };
    const result = await openPastime({
        title: id === 'leer' && libraryLevel() > 0 ? 'Leer en la biblioteca' : spec.label,
        placeLabel: text(place.name),
        keeper: { name: keeper },
        pack,
        // Leer en la biblioteca y entrenar en el patio, con su sitio dibujado; si no, el del sitio.
        place: pastimePlace(id, text(place.art), { library: libraryLevel() }),
        town: text(currentLocationName),
        night: slot.id === 'night',
        hero,
        mates: free.map(m => ({ key: m.key, name: m.name })),
        joinNote: spec.kind === 'trabajo'
            ? `Quien venga echa una mano: ${HELPER_GOLD === 1 ? 'una moneda' : `${HELPER_GOLD} monedas`} más por cabeza, y el vínculo sube un poco.`
            : id === 'patio'
                ? 'Quien venga entrena contigo y gana experiencia (los de alquiler, no); el vínculo sube un poco.'
                : 'Quien venga lo pasa contigo: el vínculo sube un poco.',
        makeScene: (names) => renderScene(pastimeScene(id, { keeper, companions: names, slot: slot.id, random: seeded(id, 'escena') }), { hero, party: partyMembers }),
        cards: id === 'cartas' ? { purse: partyPurse(), random: nextRandom } : null,
        finish: async ({ choices, mates, game }) => {
            const came = free.filter(m => mates.includes(m.key)).map(m => m.member);
            told = await settle(id, { place, choice: choiceOf(id, choices), mates: came, game });
            return told.lines;
        },
    });
    if (!result.finished) {
        if (isShellOpen()) refreshGameShell();
        return '';
    }
    postCombatNarration(pastimeLog(id, { hero: text(hero?.name), slot: slot.id, place: text(place.name), gold: told.gold, net: told.net }));
    spendDayPart(spec.kind === 'trabajo' ? 'trabajar' : 'entrenar', { label: spec.short });
    if (isShellOpen()) refreshGameShell();
    return told.lines.join(' ');
}
