/**
 * El saludo de quien atiende un sitio del pueblo, con lo que sabe de ti (J13.8 de
 * wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Las frases y cómo se eligen están en el motor (`campaign/human-lines.js`, tabla `saludo` del
 * compendio). Esto las junta con la partida: si ya te conoce (te ha visto otro día u otra
 * franja, os habéis cruzado en la historia o te mira de alguna forma), cómo te mira, la hora y
 * cuántas veces has entrado, para que cada visita traiga otra frase. Y apunta la visita
 * (`chat_metadata.greetings`), solo cuando cambia: el pueblo se vuelve a pintar a menudo.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { METADATA_KEY } from '../world-info.js';
import { attitudeBonus, readAttitudes } from '../game-engine/campaign/attitudes.js';
import { readDialogueMemory } from '../game-engine/campaign/dialogues.js';
import {
    hourOf, knowsYou, noteGreeting, readChoices, readGreetMemory, rememberChoices, townGreeting,
} from '../game-engine/campaign/human-lines.js';
import { ATTITUDES_KEY, DIALOGUE_MEMORY_KEY, PLOT_KEY, PLOT_SCENES_PLAYED_KEY } from './keys.js';
import { campaignDay } from './time.js';

/** Lo que recuerda cada uno de tus visitas. */
export const GREETINGS_KEY = 'greetings';

/** Lo que elegiste en las escenas del hilo, por el id de la opción: la gente se acuerda. */
export const SCENE_CHOICES_KEY = 'sceneChoices';

/** @returns {string[]} Lo elegido en las escenas del hilo. */
export function sceneChoices() {
    return readChoices(chat_metadata?.[SCENE_CHOICES_KEY]);
}

/**
 * Apuntar lo elegido en una escena, para que las siguientes (y las charlas) lo recuerden.
 *
 * @param {string[]} ids
 */
export function noteSceneChoices(ids) {
    if (!chat_metadata) return;
    const next = rememberChoices(chat_metadata[SCENE_CHOICES_KEY], ids);
    if (next.length === sceneChoices().length) return;
    chat_metadata[SCENE_CHOICES_KEY] = next;
    saveMetadata();
}

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Si habla en alguna escena del hilo que ya se ha jugado: Tomás, en el muelle del prólogo.
 *
 * @param {string} keeper
 * @returns {boolean}
 */
function spokeInScene(keeper) {
    const played = Array.isArray(chat_metadata?.[PLOT_SCENES_PLAYED_KEY]) ? chat_metadata[PLOT_SCENES_PLAYED_KEY].map(String) : [];
    if (played.length === 0) return false;
    const milestones = chat_metadata?.[PLOT_KEY]?.milestones;
    return (Array.isArray(milestones) ? milestones : [])
        .filter(m => played.includes(text(m?.id)))
        .some(m => (Array.isArray(m?.beats) ? m.beats : []).some((/** @type {any} */ beat) => fold(beat?.who) === fold(keeper)));
}

/**
 * Si ya os habíais cruzado antes de entrar aquí: te mira de alguna forma (hubo trato), ya
 * habéis tenido una charla escrita o habló en una escena que ya has jugado.
 *
 * @param {string} keeper
 * @param {Array<{id: string, speaker: string}>} dialogues Las charlas del mundo, para saber de quién es cada una.
 * @returns {boolean}
 */
function crossedBefore(keeper, dialogues) {
    if (!chat_metadata) return false;
    const values = readAttitudes(chat_metadata[ATTITUDES_KEY]).values;
    if (Object.keys(values).some(name => fold(name) === fold(keeper))) return true;
    const memory = readDialogueMemory(chat_metadata[DIALOGUE_MEMORY_KEY]);
    if ((Array.isArray(dialogues) ? dialogues : [])
        .some(d => fold(d?.speaker) === fold(keeper) && (memory[text(d?.id)]?.heard.length ?? 0) > 0)) return true;
    return spokeInScene(keeper);
}

/**
 * El saludo de quien atiende un sitio, con lo que sabe de ti. Vacío si no atiende nadie o no hay
 * frase: entonces vale el de siempre.
 *
 * @param {any} place El sitio (`TownPlace`).
 * @param {Object} [input]
 * @param {string} [input.slot] La franja, como la dice el reloj.
 * @param {any} [input.hero] Tu héroe.
 * @param {Array<{id: string, speaker: string}>} [input.dialogues]
 * @returns {{text: string, mood: string, remembered: boolean}}
 */
export function humanHello(place, { slot = '', hero = null, dialogues = [] } = {}) {
    const keeper = text(place?.keeper?.name);
    if (!keeper || place?.closed || !chat_metadata) return { text: '', mood: '', remembered: false };
    const stamp = `${Math.max(1, campaignDay())}|${hourOf(slot) || 'dia'}`;
    const before = chat_metadata[GREETINGS_KEY];
    const met = knowsYou(before, keeper, stamp, crossedBefore(keeper, dialogues));
    const next = noteGreeting(before, keeper, stamp);
    if (JSON.stringify(next) !== JSON.stringify(readGreetMemory(before))) {
        chat_metadata[GREETINGS_KEY] = next;
        saveMetadata();
    }
    const attitude = attitudeBonus(chat_metadata[ATTITUDES_KEY], keeper);
    const said = townGreeting({
        place, slot, hero, met, attitude,
        seed: String(chat_metadata[METADATA_KEY] ?? ''),
        turn: next[fold(keeper)]?.visits ?? 0,
    });
    return { text: said, mood: attitude >= 1 ? 'alegre' : attitude <= -2 ? 'enfadado' : '', remembered: false };
}
