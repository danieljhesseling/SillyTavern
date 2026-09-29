/**
 * La mascota (R5): tenerla, guardarla, lo que hace en el pueblo y en combate, y domar lo vencido.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldEnemies, METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { rollDiceDetailed } from './combat-rules.js';
import {
    readPet, createPet, petComment, afterComment, shouldComment, petAdvice, liveTogether, petDoes, petChoicesFor,
    tamableAs, describePet, petName, SPECIES as PET_SPECIES, CHARACTERS as PET_CHARACTERS,
} from '../game-engine/campaign/pet.js';
import { reactionsHere } from '../game-engine/campaign/pet-reception.js';
import { recordManeuver, revealHidden } from '../game-engine/combat/maneuvers.js';
import { shiftAttitude } from '../game-engine/campaign/attitudes.js';
import { keepOn, hasLetter } from '../game-engine/rules/modes.js';
import { rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import { affairsOf } from '../game-engine/campaign/week-table.js';
import { readCases } from '../game-engine/campaign/cases.js';
import { readTaggedLine } from '../game-engine/campaign/chronicle.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    ATTITUDES_KEY, BILL_DUE_KEY, BOARD_KEY, CASES_KEY, DEBT_KEY, PET_KEY, PLOT_STATE_KEY, TAKEN_KEY,
} from './keys.js';
import { combatEncounter, currentWorldFactions, partyMembers } from './state.js';
import {
    lastWorldGenre, postCombatNarration, survivalNow, lastWorldNpcs, whatComes, leavingMembers, getPlot, showTip,
    campaignDay, renderLocationMapsPreview,
} from './main.js';
import { applyTimedCondition } from './magic.js';
import { saveCombatState, getAliveEnemies, boardCellOf } from './combat-state.js';
import { persistBoardTerrain, getActiveBoardContext } from './board.js';

/** @returns {import('../game-engine/campaign/pet.js').Pet|null} */
export function currentPet() {
    return readPet(chat_metadata?.[PET_KEY]);
}

/**
 * T5: la mascota con la que llega un héroe hecho. Si ya hay una, se queda la que hay.
 *
 * @param {{name?: string, species?: string, character?: string}|null} raw
 * @returns {boolean} Si se ha quedado.
 */
export function adoptPet(raw) {
    if (!chat_metadata || !raw || currentPet()) return false;
    const made = createPet({ name: String(raw.name ?? ''), species: String(raw.species ?? ''), character: String(raw.character ?? 'leal') });
    if (!made) return false;
    keepPet(made);
    postCombatNarration(`🐾 [MASCOTA] ${petName(made)} va con vosotros desde el principio.`);
    return true;
}

/**
 * T3: la gente con oficio de un sitio ve a la mascota por primera vez: le gusta o no, lo
 * dice (sin llamar al modelo) y su actitud da un paso.
 *
 * @param {string} place
 */
export function petMeetsTown(place) {
    const pet = currentPet();
    if (!pet || !chat_metadata) return;
    const reactions = reactionsHere({
        pet, npcs: lastWorldNpcs, here: place, met: pet.met,
        speciesLabel: PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (pet.species)]?.label ?? '',
    });
    if (reactions.length === 0) return;
    let attitudes = chat_metadata[ATTITUDES_KEY];
    for (const reaction of reactions) {
        const shifted = shiftAttitude(attitudes, { name: reaction.npc, delta: reaction.mood, day: campaignDay() });
        if (shifted.ok) attitudes = shifted.state;
        postCombatNarration(`🐾 [MASCOTA] ${reaction.line}`);
    }
    chat_metadata[ATTITUDES_KEY] = attitudes;
    keepPet({ ...pet, met: [...pet.met, ...reactions.map(r => r.npc)] });
}

/**
 * R5: guardar la mascota.
 *
 * @param {import('../game-engine/campaign/pet.js').Pet|null} pet
 */
function keepPet(pet) {
    if (!chat_metadata) return;
    chat_metadata[PET_KEY] = pet;
    saveMetadata();
    // H1: la primera mascota dice qué hace.
    if (pet) showTip('pet');
}

/**
 * R5: reaccionar a una línea de la crónica. Nunca a lo suyo, y como mucho una vez cada rato.
 *
 * @param {string} text
 */
export function petReact(text) {
    const pet = currentPet();
    if (!pet || !chat_metadata) return;
    const line = readTaggedLine(text);
    if (!line || line.tag === 'MASCOTA') return;
    const now = Array.isArray(chat) ? chat.length : 0;
    if (!shouldComment({ pet, category: line.category, now, random: Math.random })) return;
    const said = petComment({ pet, category: line.category, random: Math.random });
    if (!said) return;
    keepPet(afterComment(pet, said, now));
    // Detrás de la línea que comenta, y sin volver a entrar aquí.
    setTimeout(() => postCombatNarration(said), 0);
}

/**
 * R5: algo vivido juntos (una pelea ganada, un viaje). Cada cinco, más vínculo.
 */
export function petLivesIt() {
    const pet = currentPet();
    if (!pet) return;
    const step = liveTogether(pet);
    keepPet(step.pet);
    if (step.line) postCombatNarration(step.line);
}

/** Los nombres de siempre de cada especie, para no pedir uno en blanco. */
const PET_NAMES = /** @type {Record<string, string>} */ ({
    perro: 'Canela', gato: 'Hollín', zorro: 'Rastro', halcon: 'Brisa', cuervo: 'Graznido', loro: 'Chismes', familiar: 'Chispa', espiritu: 'Susurro',
});

/**
 * R5: la mascota en un cuadro: tenerla, preguntarle, acariciarla. Sin mascota, se elige una
 * de las tres que le pegan al mundo.
 *
 * @returns {Promise<string>}
 */
export async function openPetPanel() {
    if (!chat_metadata || partyMembers.length === 0) {
        toastr.info('Abre una partida con alguien en el grupo antes.', 'La mascota');
        return '';
    }
    const pet = currentPet();
    const body = $('<div class="jr-root pet-root"></div>');
    if (!pet) {
        body.append($('<h3></h3>').text('¿Te acompaña alguien?'));
        body.append($('<p></p>').text('Una mascota no ocupa plaza ni cobra. Comenta lo que pasa, ayuda sin pelear y crece contigo.'));
        const choices = petChoicesFor(lastWorldGenre);
        const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
            okButton: false, cancelButton: 'Nadie, por ahora',
            customButtons: choices.map((species, i) => ({
                text: `${PET_NAMES[species]}, ${PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (species)].label}${PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (species)].talks ? ' (habla)' : ''}`,
                result: 60 + i, classes: ['pet-pick'],
            })),
        }).show();
        const index = Number(picked) - 60;
        const species = choices[index];
        if (!species) return '';
        const characters = Object.keys(PET_CHARACTERS);
        const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mascota', species));
        const made = createPet({ name: PET_NAMES[species], species, character: characters[Math.floor(random() * characters.length) % characters.length] });
        keepPet(made);
        if (made) postCombatNarration(`🐾 [MASCOTA] ${petName(made)} se viene contigo (${PET_CHARACTERS[made.character]}).`);
        if (isShellOpen()) refreshGameShell();
        return made ? petName(made) : '';
    }
    body.append($('<h3></h3>').text(petName(pet)));
    body.append($('<p class="pet-sheet"></p>').text(describePet(pet)));
    body.append($('<p></p>').text(PET_SPECIES[pet.species].note));
    const today = campaignDay();
    const petted = Number(chat_metadata.petPetted) === today;
    const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        customButtons: [
            { text: PET_SPECIES[pet.species].talks ? 'Preguntarle' : 'Ver qué hace', result: 71, classes: ['pet-ask'] },
            ...(petted ? [] : [{ text: 'Acariciarle', result: 72, classes: ['pet-pet'] }]),
        ],
    }).show();
    if (picked === 71) {
        const next = whatComes(today)[0] ?? null;
        const urgent = weekAffairsNow()[0] ?? null;
        const state = readCases(chat_metadata?.[CASES_KEY]);
        const missing = state.active ? state.active.clues.find(c => !state.found.includes(c.id) && !c.misleading) : null;
        const clue = missing ? `falta ${missing.how === 'registrar' ? `registrar ${missing.source.name}` : missing.how === 'rumor' ? `oír lo que se dice en ${missing.source.name}` : `hablar con ${missing.source.name}`}` : '';
        postCombatNarration(petAdvice({ pet, next, urgent: urgent ? { title: urgent.title, in: urgent.in } : null, clue }));
    } else if (picked === 72) {
        chat_metadata.petPetted = today;
        saveMetadata();
        postCombatNarration(`🐾 [MASCOTA] ${pet.name} se deja hacer, y el grupo se ríe un rato.`);
        petLivesIt();
    }
    return '';
}

/**
 * R5: los asuntos de la mesa de ahora, para que la mascota sepa qué aprieta.
 *
 * @returns {Array<{title: string, in: number|null}>}
 */
function weekAffairsNow() {
    if (!chat_metadata) return [];
    return keepOn(affairsOf({
        today: campaignDay(),
        factions: currentWorldFactions,
        taken: chat_metadata[TAKEN_KEY] ?? null,
        board: Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [],
        plot: getPlot(),
        plotState: chat_metadata[PLOT_STATE_KEY],
        debt: chat_metadata[DEBT_KEY] ?? null,
        party: partyMembers,
        rivals: hasLetter(survivalNow(), 'c'),
        mystery: readCases(chat_metadata[CASES_KEY]),
        // T7: el harto, en la mesa.
        leaving: leavingMembers().map(m => ({ id: m.id, name: String(m.name) })),
        weekDue: Number(chat_metadata[BILL_DUE_KEY]) || 0,
    }), survivalNow());
}

/**
 * R5: domar lo que se ha vencido, si es de las que se dejan. Supervivencia, CD 12.
 *
 * @param {any[]} fallen Los enemigos vencidos (las instancias del combate).
 */
export function offerTaming(fallen) {
    // T6: se mira su ficha del mundo (el dato `domable`), y solo sin ella, su nombre.
    const beasts = fallen.map(e => {
        const template = getCurrentWorldEnemies().find((/** @type {any} */ t) => String(t.id) === String(e.templateId));
        return { name: String(template?.name ?? e.name), ...(template?.domable !== undefined ? { domable: template.domable } : {}) };
    });
    const beast = beasts.find(b => tamableAs(b));
    if (!beast || !chat_metadata) return;
    const species = tamableAs(beast);
    const toast = toastr.info('Una cría de lo que acabáis de vencer se queda mirándoos. ¿Os la lleváis? (Supervivencia, CD 12)', `🐾 ${PET_SPECIES[/** @type {keyof typeof PET_SPECIES} */ (species)].label}`, { timeOut: 15000, extendedTimeOut: 5000, closeButton: true });
    $(toast).find('.toast-message').append($('<button class="menu_button pet-tame" style="margin-top:6px;"></button>').text('Intentarlo').on('click', () => {
        const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0).reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'survival').modifier > skillModifier(top, 'survival').modifier ? m : top), null);
        const roll = who ? rollCheck({ member: who, skill: 'survival', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: 12 }) : null;
        if (roll) postCombatNarration(roll.said);
        if (!roll?.success || currentPet()) {
            postCombatNarration('🐾 [MASCOTA] Se escapa entre la maleza. Otra vez será.');
            return;
        }
        const characters = Object.keys(PET_CHARACTERS);
        const made = createPet({ name: PET_NAMES[species] ?? 'Sin nombre', species, character: characters[Math.floor(Math.random() * characters.length) % characters.length] });
        keepPet(made);
        if (made) postCombatNarration(`🐾 [MASCOTA] ${petName(made)} se viene con vosotros.`);
    }));
}

/**
 * R5: la carta de la mascota con labia (el cuervo, el loro): roba la atención.
 *
 * @returns {any[]}
 */
export function petTricks() {
    const pet = currentPet();
    if (!pet || !petDoes(pet, 'labia')) return [];
    return [{ id: 'truco:mascota', kind: 'truco', label: `Que ${pet.name} le robe la atención`, as: 'enganar', power: 2 }];
}

/**
 * R5: la mascota ayuda en combate: una vez por ronda, sin gastar la acción de nadie.
 *
 * @param {string} action
 * @param {any} enemy
 */
export function petSupport(action, enemy) {
    const pet = currentPet();
    if (!pet || !combatEncounter.active) return;
    /** @type {any} */ (combatEncounter).petRound = Number(combatEncounter.round) || 1;
    if (action === 'avisar') {
        combatEncounter.maneuvers = recordManeuver(combatEncounter.maneuvers, 'ayudar', 'mascota', String(enemy.instanceId));
        postCombatNarration(`🐾 [COMBAT] ${pet.name} señala a ${enemy.name}: el siguiente golpe del grupo va con ventaja.`);
    } else if (action === 'distraer') {
        applyTimedCondition(enemy, String(enemy.instanceId), 'Distraído', 1);
        postCombatNarration(`🐾 [COMBAT] ${pet.name} se le mete entre las piernas a ${enemy.name}: su próximo golpe va con desventaja.`);
    } else if (action === 'rastrear') {
        const board = getActiveBoardContext().board;
        const hero = partyMembers[0];
        const at = boardCellOf(hero);
        let found = 0;
        if (board && Array.isArray(board.hazards)) {
            board.hazards = board.hazards.map((/** @type {any} */ h) => {
                if (h?.seen || Math.max(Math.abs(Number(h?.x) - at.x), Math.abs(Number(h?.y) - at.y)) > 4) return h;
                found++;
                return { ...h, seen: true };
            });
            persistBoardTerrain(board);
        }
        for (const foe of getAliveEnemies()) combatEncounter.maneuvers = revealHidden(combatEncounter.maneuvers, String(foe.instanceId));
        postCombatNarration(`🐾 [COMBAT] ${pet.name} olfatea alrededor${found > 0 ? `: ${found} trampa(s) a la vista` : ''}, y quien se escondía, ya no.`);
    }
    saveCombatState();
    renderLocationMapsPreview();
}
