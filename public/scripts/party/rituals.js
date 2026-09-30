/**
 * Los rituales, fuera de combate (J19.8; D-J27: el erudito lanza solo rituales, sin
 * espacios): el cuadro para lanzarlos desde el grimorio y lo que hace cada uno.
 *
 * Qué se puede lanzar y qué pasa lo decide `game-engine/rules/rituals.js`; aquí se aplica a
 * las fichas, se gasta el material (D-J25) y se cuenta. Lanzar un ritual no gasta una parte
 * del día: son diez minutos.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { METADATA_KEY } from '../world-info.js';
import { removeItemFromInventory } from '../dnd-system.js';
import {
    ritualChoices, detectMagic, identifyAll, purifyAll, summonFamiliar, setAlarm, alarmActive, understandTongues,
    ALARM_WATCH_BONUS,
} from '../game-engine/rules/rituals.js';
import { templeWork } from '../game-engine/campaign/item-lore.js';
import { petName } from '../game-engine/campaign/pet.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { PET_KEY } from './keys.js';
import { combatEncounter, partyMembers } from './state.js';
import { classRowOf, spellRows, othersOf } from './magic.js';
import { currentPet } from './pet.js';
import { getCampaignCalendar } from './time.js';
import { postCombatNarration } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';

/**
 * Los rituales de alguien, cada uno con si se puede lanzar ahora y por qué no.
 *
 * @param {any} member
 * @returns {import('../game-engine/rules/rituals.js').RitualChoice[]}
 */
export function ritualsFor(member) {
    const pet = currentPet();
    return ritualChoices({
        member,
        classRow: classRowOf(member),
        catalogue: spellRows(),
        inCombat: Boolean(combatEncounter.active),
        carried: Array.isArray(member?.items) ? member.items : [],
        others: othersOf(member),
        state: {
            unknownItems: templeWork(partyMembers).unknown.length,
            pet: pet ? petName(pet) : '',
            alarmSet: alarmTonight(),
        },
    });
}

/**
 * Si esta noche hay una alarma puesta (el ritual Alarma): la guardia del campamento suma
 * `ALARM_WATCH_BONUS`. Lo mira la noche de `party/travel.js`.
 *
 * @returns {number} Lo que suma a la guardia (0 si no hay alarma).
 */
export function alarmBonus() {
    return alarmTonight() ? ALARM_WATCH_BONUS : 0;
}

/** @returns {boolean} */
function alarmTonight() {
    const calendar = getCampaignCalendar();
    return partyMembers.some(m => !m.dead && alarmActive(/** @type {any} */ (m).ritualAlarm, calendar));
}

/**
 * El cuadro de los rituales de alguien: cada uno con lo que hace y su botón, o por qué no se
 * puede ahora. Lanzar uno lo aplica y lo cuenta.
 *
 * @param {any} member
 * @returns {Promise<string>} Lo que se ha hecho, o vacío.
 */
export async function openRituals(member) {
    if (!member) return '';
    if (combatEncounter.active) {
        toastr.info('Un ritual lleva diez minutos: peleando no hay tiempo.', 'Rituales');
        return '';
    }
    const choices = ritualsFor(member);
    if (choices.length === 0) {
        toastr.info(`${member.name} no tiene ningún ritual a mano.`, 'Rituales');
        return '';
    }
    const body = $('<div class="jr-root gr-root gr-rituals"></div>');
    body.append($('<h3></h3>').text(`${member.name}: lanzar un ritual`));
    body.append($('<div class="jr-item"></div>').text('Un ritual no gasta espacio de conjuro: lleva diez minutos más, y no se lanza peleando.'));
    let picked = '';
    /** @type {any} */
    let popup = null;
    for (const choice of choices) {
        const row = $('<div class="jr-item gr-ritual-row"></div>').attr('data-ritual', choice.id);
        row.append($('<div class="jr-title gr-ritual-name"></div>').text(choice.name));
        row.append($('<div class="gr-ritual-note"></div>').text(choice.note));
        if (!choice.ok) row.append($('<div class="gr-ritual-why"></div>').text(choice.reason));
        const cast = $('<button type="button" class="menu_button gr-ritual-cast"></button>')
            .text(`Lanzar (${choice.minutes} minutos)`)
            .prop('disabled', !choice.ok)
            .attr('title', choice.ok ? choice.note : choice.reason);
        cast.on('click', () => {
            picked = choice.id;
            void popup?.completeAffirmative();
        });
        row.append(cast);
        body.append(row);
    }
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true });
    await popup.show();
    return picked ? castRitual(member, picked) : '';
}

/**
 * Lanzar un ritual: se comprueba otra vez, se aplica, se gasta el material y se cuenta.
 *
 * @param {any} member
 * @param {string} spellId
 * @returns {string} Lo que se ha hecho, o vacío.
 */
export function castRitual(member, spellId) {
    const choice = ritualsFor(member).find(c => c.id === spellId);
    if (!choice) return '';
    if (!choice.ok) {
        toastr.warning(choice.reason, 'Rituales');
        return '';
    }
    const caster = String(member.name ?? '');
    const calendar = getCampaignCalendar();
    /** @type {string[]} */
    let lines = [];
    switch (choice.kind) {
        case 'detect':
            lines = detectMagic({ caster, party: partyMembers });
            break;
        case 'identify': {
            const done = identifyAll({ caster, party: partyMembers });
            for (const change of done.changes) {
                const owner = partyMembers.find(m => String(m.id) === change.memberId);
                const index = (Array.isArray(owner?.items) ? owner.items : []).findIndex((/** @type {any} */ i) => String(i?.id) === change.itemId);
                if (owner && index >= 0) /** @type {any[]} */ (owner.items)[index] = change.item;
            }
            lines = done.lines;
            break;
        }
        case 'purify': {
            const done = purifyAll({ caster, party: partyMembers });
            for (const change of done.changes) {
                const who = partyMembers.find(m => String(m.id) === change.memberId);
                if (who) who.needs = change.needs;
            }
            lines = done.lines;
            break;
        }
        case 'alarm': {
            const done = setAlarm({ caster, calendar });
            member.ritualAlarm = done.alarm;
            lines = done.lines;
            break;
        }
        case 'tongues': {
            const done = understandTongues({ caster, calendar });
            member.tongues = done.tongues;
            lines = done.lines;
            break;
        }
        case 'familiar': {
            const world = String(chat_metadata?.[METADATA_KEY] || '');
            const done = summonFamiliar({ caster, random: createSeededRandom(derive(world, 'familiar', caster, String(calendar?.day ?? 0))) });
            if (!done.pet || !chat_metadata) return '';
            chat_metadata[PET_KEY] = done.pet;
            saveMetadata();
            lines = done.lines;
            break;
        }
        default:
            return '';
    }
    // D-J25: lo que el ritual gasta (el incienso de Encontrar familiar), de quien lo lanza.
    for (const name of choice.consumes) {
        const item = (Array.isArray(member.items) ? member.items : [])
            .find((/** @type {any} */ i) => String(i?.name ?? '').trim().toLowerCase() === String(name).trim().toLowerCase());
        if (!item) continue;
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        lines.push(`Se gasta ${String(name).toLowerCase()}.`);
    }
    savePartyState();
    renderPartyMembers();
    const head = `${caster} lanza ${choice.name} como ritual (${choice.minutes} minutos).`;
    postCombatNarration(`📖 [MAGIA] ${[head, ...lines].join(' ')}`);
    void Popup.show.text(choice.name, [head, ...lines].join('\n'));
    if (isShellOpen()) refreshGameShell();
    return head;
}
