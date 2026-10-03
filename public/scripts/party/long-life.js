/**
 * E8 de wiki/ROADMAP_ENTRETENIDO.md, «La larga vida» (D-J64), en la partida: lo que une las
 * piezas puras con el grupo, el gremio y el templo.
 *
 * - **E8.2**: después del nivel 20, la tarjeta de los dones épicos (`rules/epic-boons.js`).
 * - **E8.3**: retirarse al gremio de maestro, y lo que aprenden de él los nuevos
 *   (`campaign/retirement.js`).
 * - **E8.5 y E8.6**: por qué llevar mercenarios, al contratarles, y los veteranos que vuelven
 *   de tres salidas (`campaign/mercenary-life.js`).
 * - **E8.7**: devolver la vida en el templo, con su diamante y su secuela
 *   (`rules/resurrection.js`), salvo en el modo duro.
 *
 * Todo lo que se cuenta lo dice alguien que está (D-J60): quien lleva el gremio, el maestro,
 * el veterano o quien atiende el templo, en una charla con retrato.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata, saveSettingsDebounced } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { METADATA_KEY, getCurrentWorldLocationMaps, getCurrentWorldEnemies } from '../world-info.js';
import { removeItemFromInventory } from '../dnd-system.js';
import { applyInjury } from '../game-engine/rules/injuries.js';
import { PERKS, takePerk } from '../game-engine/rules/level-perks.js';
import { EPIC_BOONS, boonChoices, pendingBoons, takeBoon, xpToNextBoon, ABILITY_WORDS, boonAbility } from '../game-engine/rules/epic-boons.js';
import { raiseOffer, isRaisable, raiseScar, raisedWeakness, raiseScene, raisedBasics } from '../game-engine/rules/resurrection.js';
import {
    MENTORS_KEY, readMentors, canRetire, retireHero, retirementScene, retireChoice, mentorStartLevel, mentorStartXp,
    lessonsFor, lessonScene, lessonChoice, noteTaught, hasGuildPerk, mentorPrice, guildPerks, MENTOR_PURSE, MENTOR_DISCOUNT,
} from '../game-engine/campaign/retirement.js';
import { hireReasons, noteTrip, dueVeterans, promoteVeteran, veteranScene } from '../game-engine/campaign/mercenary-life.js';
import { addToHall, readGraves, withoutFallen } from '../game-engine/campaign/legacy.js';
import { derive } from '../game-engine/campaign/seed.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { openMeetupScene } from '../game-engine/ui/meetup-scene.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { BOARD_KEY, GRAVES_KEY } from './keys.js';
import { combatEncounter, currentLocationName, partyMembers, setPartyMembers } from './state.js';
import { savePartyState, renderPartyMembers, partyPurse, payFromParty } from './roster.js';
import { campaignDay, currentUpkeepRules } from './time.js';
import { currentSurvival } from './modes.js';
import { lastHub, lastPack, lastWorldNpcs } from './world.js';
import { postCombatNarration } from './narration.js';
import { noteDeed } from './world-growth.js';
import { getXpTable, openLevelUpCard } from './level-up.js';
import { deathIsFinal } from './combat-flow.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** El pack de los retratos y fondos de las charlas: el del gremio, en el gremio. */
function packNow() {
    return lastHub ? 'gremio' : text(lastPack);
}

/** @returns {import('../game-engine/campaign/retirement.js').Mentor[]} */
function mentorsNow() {
    return readMentors(chat_metadata?.[MENTORS_KEY]);
}

/** @param {any} member @returns {{name: string, className: string, gender: string}} */
function personOf(member) {
    return { name: text(member?.name), className: text(member?.className ?? member?.class ?? member?.charClass), gender: text(member?.gender) };
}

/** Quien atiende un servicio de aquí, por su nombre, o su papel. @param {string} service @param {string} fallback */
function keeperHere(service, fallback) {
    const here = text(currentLocationName).toLowerCase();
    return lastWorldNpcs.find((/** @type {any} */ n) => n.service === service && text(n.where).toLowerCase() === here)?.name
        ?? lastWorldNpcs.find((/** @type {any} */ n) => n.service === service)?.name
        ?? fallback;
}

function refresh() {
    savePartyState();
    renderPartyMembers();
    if (isShellOpen()) refreshGameShell();
}

// ---------------------------------------------------------------------------------------
// E8.7: el templo.

/**
 * Lo que el templo de aquí puede hacer por los vuestros que cayeron: una acción por cada uno.
 * Con el modo duro, sale apagada y dice por qué.
 *
 * @returns {Array<{id: string, label: string, detail: string, enabled: boolean, cost: number, target: string}>}
 */
export function templeRaiseActions() {
    const hard = deathIsFinal();
    const mentors = mentorsNow();
    const discount = hasGuildPerk(mentors, 'templo') ? MENTOR_DISCOUNT : 0;
    return partyMembers.filter(m => m?.dead && isRaisable(m)).map(member => {
        const offer = raiseOffer({
            member, today: campaignDay(), purse: partyPurse(), party: partyMembers, hard, discount, fighting: combatEncounter.active,
        });
        return {
            id: `temple-raise:${member.id}`,
            label: offer.spell ? `Devolver la vida a ${member.name} (${offer.gold} de oro)` : `Devolver la vida a ${member.name}`,
            detail: offer.enabled ? offer.detail : offer.reason,
            enabled: offer.enabled,
            // Se cobra al hacerlo (`raiseAtTemple`): el oro y los diamantes van juntos.
            cost: 0,
            target: String(member.id),
        };
    });
}

/**
 * Devolver la vida a alguien en el templo: se paga, se gasta el diamante, vuelve débil y con
 * una secuela, y lo dicen quien lanza el conjuro y quien vuelve.
 *
 * @param {string} memberId
 * @returns {Promise<string>}
 */
export async function raiseAtTemple(memberId) {
    const member = partyMembers.find(m => String(m.id) === String(memberId));
    if (!member || !chat_metadata) return '';
    const mentors = mentorsNow();
    const offer = raiseOffer({
        member, today: campaignDay(), purse: partyPurse(), party: partyMembers, hard: deathIsFinal(),
        discount: hasGuildPerk(mentors, 'templo') ? MENTOR_DISCOUNT : 0, fighting: combatEncounter.active,
    });
    if (!offer.enabled || !offer.spell) {
        toastr.warning(offer.reason, 'El templo');
        return '';
    }
    if (offer.gold > 0 && !payFromParty(offer.gold)) {
        toastr.warning(`No llega el oro: hacen falta ${offer.gold}.`, 'El templo');
        return '';
    }
    // Los diamantes vuestros, gastados: de uno en uno (un montón baja de uno en uno).
    for (const gem of offer.diamonds) {
        const owner = /** @type {any} */ (partyMembers.find(m => String(m.id) === gem.memberId));
        const item = owner?.items?.find((/** @type {any} */ i) => String(i.id) === gem.itemId);
        if (!owner || !item) continue;
        if ((Number(item.quantity) || 1) > 1) item.quantity = Number(item.quantity) - 1;
        else removeItemFromInventory(owner, gem.itemId);
    }
    const random = createSeededRandom(derive(text(chat_metadata[METADATA_KEY]), 'templo', text(member.id), campaignDay()));
    const scar = raiseScar(member, random);
    Object.assign(member, raisedBasics(member, offer.spell));
    for (const injury of [raisedWeakness(), scar]) {
        // Una fila de la tabla, como `INJURY_TABLE`: `applyInjury` la normaliza.
        const patch = applyInjury(member, /** @type {any} */ (injury));
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);
    }
    // Lo poco que pueda quedar en la vida que se le quitó con la debilidad, y nunca a 0.
    member.hp = Math.max(1, Math.min(Number(member.hp) || 1, Number(member.maxHp) || 1));
    delete /** @type {any} */ (member).diedOn;
    delete /** @type {any} */ (member).revivable;
    // Ya no es de los caídos: ni su tumba ni su sitio en el salón de la fama.
    chat_metadata[GRAVES_KEY] = readGraves(chat_metadata[GRAVES_KEY]).filter(g => g.name !== text(member.name));
    const settings = /** @type {any} */ (extension_settings);
    settings.partyHall = withoutFallen(settings.partyHall, { name: text(member.name), world: text(chat_metadata[METADATA_KEY]) });
    saveSettingsDebounced();
    await saveMetadata();
    refresh();
    const line = `${member.name} vuelve a la vida en el templo (${offer.spell.label}, ${offer.gold} de oro). Le queda: ${scar.label.toLowerCase()}.`;
    postCombatNarration(`🕯️ [TEMPLO] ${line}`);
    noteDeed(line);
    const hero = partyMembers.find(m => !m.guest && !m.dead && m !== member);
    const priest = keeperHere('templo', 'El sacerdote');
    await openMeetupScene({
        scene: raiseScene({ member, spell: offer.spell, scar, priest, hero: text(hero?.name) }),
        person: { name: priest },
        cast: [{ name: priest }, personOf(member)],
        pack: packNow(),
        place: 'templo',
        town: text(currentLocationName),
        placeLabel: 'El templo',
        canLeave: false,
    }).catch(error => console.error('[templo] la escena', error));
    toastr.success(line, 'El templo', { timeOut: 10000 });
    return line;
}

// ---------------------------------------------------------------------------------------
// E8.3: retirarse al gremio.

/** @returns {boolean} Si el héroe que va puede retirarse ahora (para la ficha del gremio). */
export function canRetireNow() {
    const hero = partyMembers.find(m => !m.guest);
    return Boolean(lastHub) && canRetire(hero, { fighting: combatEncounter.active, inGuild: Boolean(lastHub) }).ok;
}

/**
 * Retirar al héroe que va: la charla con quien lleva el gremio y, si dice que sí, se queda de
 * maestro, entra en el Salón de la fama y se elige quién va ahora (o se hace otro).
 *
 * @returns {Promise<string>}
 */
export async function openRetirement() {
    const hero = partyMembers.find(m => !m.guest);
    const can = canRetire(hero, { fighting: combatEncounter.active, inGuild: Boolean(lastHub) });
    if (!can.ok || !hero || !chat_metadata) {
        toastr.info(can.reason || 'Aquí no se retira nadie.', 'Retirarse');
        return '';
    }
    const master = keeperHere('gremio', 'Brunilda');
    const scene = retirementScene({ hero, master });
    const result = await openMeetupScene({
        scene,
        person: { name: master },
        cast: [{ name: master }, personOf(hero)],
        pack: packNow(),
        place: 'gremio',
        town: text(currentLocationName),
        placeLabel: 'El gremio',
        canLeave: true,
    });
    if (!result.finished || retireChoice(scene, result.choices) !== 'retira') return '';

    const done = retireHero(hero, {
        mentors: chat_metadata[MENTORS_KEY], day: campaignDay(), world: text(chat_metadata[METADATA_KEY]), guild: text(currentLocationName),
    });
    chat_metadata[MENTORS_KEY] = done.mentors;
    const settings = /** @type {any} */ (extension_settings);
    settings.partyHall = addToHall(settings.partyHall, done.hall);
    saveSettingsDebounced();
    setPartyMembers(partyMembers.filter(m => m !== hero));
    await saveMetadata();
    refresh();
    postCombatNarration(`🎓 [GREMIO] ${done.line}`);
    noteDeed(done.line);
    toastr.success(done.line, 'Un maestro en el gremio', { timeOut: 12000 });
    // Quién va ahora: otro de los tuyos, o uno nuevo, que llega con ventaja.
    const { openHubHeroes } = await import('./hub.js');
    await openHubHeroes();
    if (!partyMembers.some(m => !m.guest)) {
        const { changeHubHero } = await import('../campaigns.js');
        await changeHubHero({ create: true });
    }
    return done.line;
}

/**
 * Lo que trae un héroe nuevo de un gremio con maestros: la experiencia de un nivel más alto, la
 * bolsa (si un maestro la pone) y una dote que aprende de ellos, elegida en una charla.
 *
 * Lo llama `changeHubHero` (campaigns.js) justo después de hacer al nuevo.
 *
 * @returns {Promise<void>}
 */
export async function welcomeNewHero() {
    const mentors = mentorsNow();
    const hero = /** @type {any} */ (partyMembers.find(m => !m.guest));
    if (mentors.length === 0 || !hero || !chat_metadata) return;
    /** @type {string[]} */
    const said = [];
    const xp = mentorStartXp(mentors, getXpTable());
    const start = mentorStartLevel(mentors);
    if (xp > (Number(hero.xp) || 0)) {
        hero.xp = xp;
        said.push(`${hero.name} llega con lo aprendido de los maestros: ya puede subir al nivel ${start}.`);
    }
    if (hasGuildPerk(mentors, 'bolsa')) {
        hero.gold = (Number(hero.gold) || 0) + MENTOR_PURSE;
        const who = guildPerks(mentors).find(p => p.id === 'bolsa')?.who ?? '';
        said.push(`${who || 'Un maestro'} le pone ${MENTOR_PURSE} de oro en la bolsa.`);
    }
    refresh();
    for (const line of said) postCombatNarration(`🎓 [GREMIO] ${line}`);
    const scene = lessonScene({ hero, lessons: lessonsFor(mentors, hero), start });
    if (scene) {
        const result = await openMeetupScene({
            scene,
            person: { name: scene.who },
            cast: [{ name: scene.who, className: mentors.find(m => m.name === scene.who)?.className ?? '', gender: mentors.find(m => m.name === scene.who)?.gender ?? '' }, personOf(hero)],
            pack: packNow(),
            place: 'gremio',
            town: text(currentLocationName),
            placeLabel: 'El gremio',
            canLeave: false,
        }).catch(error => {
            console.error('[gremio] la lección', error);
            return { finished: false, choices: [] };
        });
        const picked = result.finished ? lessonChoice(scene, result.choices) : null;
        if (picked) {
            const patch = takePerk(hero, picked.lesson);
            if (patch) Object.assign(hero, patch);
            chat_metadata[MENTORS_KEY] = noteTaught(mentors, picked.mentor, text(hero.name));
            await saveMetadata();
            refresh();
            const lesson = PERKS.find(p => p.id === picked.lesson);
            const line = `${hero.name} aprende de ${picked.mentor}: ${lesson ? `${lesson.label} (${lesson.describe.replace(/\.$/, '')})` : picked.lesson}.`;
            postCombatNarration(`🎓 [GREMIO] ${line}`);
            noteDeed(line);
        }
    }
    if (said.length > 0) toastr.success(said.join(' '), 'Los maestros del gremio', { timeOut: 10000 });
    // Con la experiencia ya puesta, la subida, con sus decisiones.
    if (xp > 0) await openLevelUpCard(hero);
}

// ---------------------------------------------------------------------------------------
// E8.5 y E8.6: los mercenarios.

/**
 * Las ofertas del gremio con lo que hace falta para decidir (E8.5) y la rebaja de un maestro
 * (E8.3), si la hay. Un veterano contratado sale con su apodo.
 *
 * @template {{name: string, className: string, fee: number, hired: boolean, id: string, gender?: string}} T
 * @param {T[]} offers
 * @returns {Array<T & {reasons: any[], nickname: string}>}
 */
export function withHireReasons(offers) {
    const mentors = mentorsNow();
    const wage = currentSurvival().upkeep ? Math.max(0, Number(currentUpkeepRules()?.wagePerWeek) || 0) : 0;
    const by = guildPerks(mentors).find(p => p.id === 'armas')?.who ?? '';
    return offers.map(offer => {
        const fee = mentorPrice(offer.fee, mentors, 'armas');
        const hired = offer.hired ? /** @type {any} */ (partyMembers.find(m => String(m.id) === offer.id)) : null;
        return {
            ...offer,
            fee: offer.hired ? offer.fee : fee,
            nickname: text(hired?.nickname),
            reasons: offer.hired ? [] : hireReasons({ offer: { ...offer, fee }, party: partyMembers, wage, baseFee: offer.fee, cheaperBy: by }),
        };
    });
}

/**
 * Una salida más para los mercenarios vivos: lo llama `returnToHub` antes de salir de la campaña.
 *
 * @param {string} campaign El nombre de la campaña (o del mundo).
 */
export function countMercenaryTrips(campaign) {
    if (!partyMembers.some(m => m?.guest?.kind === 'mercenary' && !m.dead)) return;
    setPartyMembers(noteTrip(partyMembers, campaign));
    savePartyState();
}

/**
 * Ya en el gremio: quien ha vuelto vivo de tres salidas se gana su apodo, su rasgo, su recuerdo
 * y su misión (al tablón), y lo cuenta él.
 *
 * @returns {Promise<string[]>} Lo que se ha dicho.
 */
export async function promoteVeterans() {
    if (!chat_metadata) return [];
    /** @type {string[]} */
    const lines = [];
    const places = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => text(l?.name)).filter(Boolean);
    const bestiary = getCurrentWorldEnemies().map((/** @type {any} */ e) => text(e?.name)).filter(Boolean);
    const hero = partyMembers.find(m => !m.guest && !m.dead);
    for (const member of dueVeterans(partyMembers)) {
        const random = createSeededRandom(derive(text(chat_metadata[METADATA_KEY]), 'veterano', text(member.id)));
        const up = promoteVeteran(member, {
            random, places: places.length > 0 ? places : [text(currentLocationName) || 'el camino'],
            here: text(currentLocationName), bestiary, day: campaignDay(), heroName: text(hero?.name),
        });
        Object.assign(member, up.patch);
        const board = Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [];
        if (!board.some((/** @type {any} */ c) => c?.id === up.mission.id)) board.unshift(up.mission);
        chat_metadata[BOARD_KEY] = board;
        const line = `${member.name} ya es veterano: le llaman «${up.nickname}»${up.trait ? ` y ha aprendido ${up.trait.label.toLowerCase()}` : ''}. Su misión está en el tablón: ${up.mission.title}.`;
        lines.push(line);
        postCombatNarration(`🎖️ [GREMIO] ${line}`);
        noteDeed(line);
        await saveMetadata();
        refresh();
        await openMeetupScene({
            scene: veteranScene({ member, nickname: up.nickname, trait: up.trait, memory: up.memory, mission: up.mission }),
            person: personOf(member),
            pack: packNow(),
            place: 'gremio',
            town: text(currentLocationName),
            placeLabel: 'El gremio',
            canLeave: false,
        }).catch(error => console.error('[gremio] el veterano', error));
    }
    if (lines.length > 0) toastr.success(lines.join('\n'), '🎖️ Veteranos', { timeOut: 12000 });
    return lines;
}

// ---------------------------------------------------------------------------------------
// E8.2: los dones épicos.

/**
 * La tarjeta de un don épico: los que puede coger, con lo que dan, y la característica que sube.
 *
 * @param {any} member
 * @returns {Promise<string>}
 */
export async function openBoonCard(member) {
    const table = getXpTable();
    if (pendingBoons(member, table) <= 0) {
        toastr.info(`${member?.name}: el siguiente don llega con ${xpToNextBoon(member, table)} PX más.`, 'Dones épicos');
        return '';
    }
    const root = $('<div class="lu-card ll-boons"></div>');
    root.append($('<div class="lu-title"></div>').append($('<span></span>').text(`${member.name}: un don épico`)));
    root.append($('<p class="ll-note"></p>').text(
        'Pasado el nivel 20 ya no se sube: cada 30.000 PX de más dan un don. Cada don sube además en 1 una característica (hasta 30).'));
    const list = $('<div class="ll-boon-list" role="radiogroup"></div>');
    /** @type {string} */
    let chosen = '';
    for (const boon of boonChoices(member)) {
        const ability = boonAbility(member, boon);
        const button = $('<button type="button" class="menu_button ll-boon"></button>').attr('data-boon', boon.id)
            .append($('<b></b>').text(boon.label))
            .append($('<span></span>').text(` ${boon.describe}${ability ? ` +1 a ${ABILITY_WORDS[ability]}.` : ''}`));
        button.on('click', () => {
            chosen = boon.id;
            list.find('.ll-boon').removeClass('is-picked').attr('aria-checked', 'false');
            button.addClass('is-picked').attr('aria-checked', 'true');
        });
        list.append(button);
    }
    root.append(list);
    const ok = await new Popup(root[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Coger el don', cancelButton: 'Ahora no', allowVerticalScrolling: true }).show();
    if (!ok || !chosen) return '';
    const taken = takeBoon(member, chosen, { table });
    if (!taken.ok || !taken.patch) {
        toastr.warning(taken.reason, 'Dones épicos');
        return '';
    }
    Object.assign(member, taken.patch);
    refresh();
    postCombatNarration(`🌟 [NIVEL] ${taken.line}`);
    noteDeed(taken.line);
    toastr.success(taken.line, 'Don épico', { timeOut: 10000 });
    return taken.line;
}

/** Para las pruebas del navegador: cuántos dones hay en la lista. */
export const EPIC_BOON_COUNT = EPIC_BOONS.length;
