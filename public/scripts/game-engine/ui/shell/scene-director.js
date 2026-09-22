/**
 * The scene director: which screen the game should be showing.
 *
 * Pure. It receives what the *engine* knows about the game and returns a scene name and
 * the reason for it. No DOM, no jQuery, no reading of globals, so every rule below is a
 * test rather than something you have to reproduce by playing.
 *
 * It deliberately does NOT read the state of the dynamic-context-manager, even though
 * that module also has a combat/exploration/social machine. That state is decided by the
 * *model*: `detectStateFromMessage` guesses it from its own prose and the `dnd_update_state`
 * tool lets it set the state outright. A line of scene-setting saying "everyone, roll
 * initiative" would jump to the combat screen with no combat behind it. The engine knows
 * whether there is an encounter; the narrator only knows what it just wrote.
 *
 * See wiki/PROPUESTA_FRONTEND_MODO_JUEGO.md, secciones 0.1 y 2 · wiki/ROADMAP.md, Fase H (H1).
 */

import { holdDuringCombat } from '../../combat/combat-hold.js';

/**
 * @typedef {'title'|'dialogue'|'exploration'|'combat'} SceneName
 */

/**
 * What the engine knows. Everything here is a fact the game can check without asking the
 * model: is a chat open, is there an encounter running, which board and location are open.
 *
 * @typedef {Object} GameSituation
 * @property {boolean} [hasChat] Whether a campaign chat is open at all.
 * @property {boolean} [combatActive] Whether the encounter is running.
 * @property {string} [boardName] The tactical board currently open, if any.
 * @property {string} [locationName] The location currently open, if any.
 * @property {boolean} [hasWorldMap] Whether the world has a map to explore.
 * @property {number} [placeCount] Cuantas localidades tiene el mundo: con una sola, no hay
 *           a donde viajar y explorar no es una escena, es un cartel.
 */

/**
 * @typedef {Object} SceneChoice
 * @property {SceneName} scene The screen to show.
 * @property {string} reason Why, in words, for the tooltip and for the tests.
 * @property {'engine'|'manual'} source Who decided: the situation or the player.
 * @property {boolean} manualHeld Whether a manual pick is still standing. When false and
 *   a manual pick was passed in, the caller should forget it: it stopped being available.
 */

/** The four screens. */
export const SCENE = /** @type {const} */ ({
    TITLE: 'title',
    DIALOGUE: 'dialogue',
    EXPLORATION: 'exploration',
    COMBAT: 'combat',
});

/**
 * The three the player can switch between by hand, in shortcut order. The title screen is
 * not one of them: you reach it by leaving the game, not by pressing a key.
 *
 * @type {SceneName[]}
 */
export const SWITCHABLE_SCENES = [SCENE.DIALOGUE, SCENE.EXPLORATION, SCENE.COMBAT];

/**
 * Label and icon per scene, so the switcher and the tests name them the same way.
 *
 * @type {Record<SceneName, {label: string, icon: string, shortcut: string}>}
 */
export const SCENE_INFO = {
    title: { label: 'Titulo', icon: 'fa-flag', shortcut: '' },
    dialogue: { label: 'Dialogo', icon: 'fa-comments', shortcut: '1' },
    exploration: { label: 'Exploracion', icon: 'fa-map', shortcut: '2' },
    combat: { label: 'Combate', icon: 'fa-chess-board', shortcut: '3' },
};

/**
 * Whether a scene has anything to show right now.
 *
 * A manual pick is honoured only while its scene is available: choosing the board and
 * then closing it would otherwise leave the player staring at an empty stage with no
 * hint about what happened.
 *
 * @param {SceneName} scene
 * @param {GameSituation} situation
 * @returns {boolean}
 */
export function isSceneAvailable(scene, situation) {
    const state = situation || {};
    switch (scene) {
        case SCENE.COMBAT:
            // A board with no fight on it is still the tactical screen: it is how you
            // look the room over before walking into it.
            return Boolean(state.combatActive) || Boolean(state.boardName);
        case SCENE.EXPLORATION:
            // Con una pelea en marcha el mapa es la puerta por la que se sale del combate
            // sin decidirlo: dejaba el encuentro vivo sobre un tablero que ya no estabas
            // mirando. Abandonar sigue teniendo su boton.
            if (state.combatActive) return false;
            // Y explorar pide **a donde ir**. Estar en un sitio no es explorar: con una
            // sola localidad y sin mapa, esa pestaña abria un mapa de un punto.
            return Boolean(state.hasWorldMap) || Number(state.placeCount) > 1;
        case SCENE.DIALOGUE:
            // The chat is always there to talk to.
            return true;
        case SCENE.TITLE:
            return true;
        default:
            return false;
    }
}

/**
 * Decide the scene.
 *
 * The order is the whole design: no chat means the title screen and nothing else; a
 * manual pick beats the situation while it lasts; a running fight beats an open board;
 * an open board beats the map; and when nothing else applies the game is a conversation.
 *
 * @param {GameSituation} situation What the engine knows.
 * @param {SceneName|null} [manual] The scene the player picked by hand, if any.
 * @returns {SceneChoice}
 */
export function chooseScene(situation, manual = null) {
    const state = situation || {};

    if (!state.hasChat) {
        return { scene: SCENE.TITLE, reason: 'no hay ninguna partida abierta', source: 'engine', manualHeld: false };
    }

    if (manual && SWITCHABLE_SCENES.includes(manual) && isSceneAvailable(manual, state)) {
        return {
            scene: manual,
            reason: `elegida a mano (${SCENE_INFO[manual].label.toLowerCase()})`,
            source: 'manual',
            manualHeld: true,
        };
    }

    /** @type {SceneChoice} */
    const automatic = state.combatActive
        ? { scene: SCENE.COMBAT, reason: 'hay un combate en curso', source: 'engine', manualHeld: false }
        : state.boardName
            ? { scene: SCENE.COMBAT, reason: `el tablero "${state.boardName}" esta abierto`, source: 'engine', manualHeld: false }
            : (state.locationName || state.hasWorldMap)
                ? { scene: SCENE.EXPLORATION, reason: state.locationName ? `el grupo esta en ${state.locationName}` : 'hay mapa de mundo', source: 'engine', manualHeld: false }
                : { scene: SCENE.DIALOGUE, reason: 'no hay tablero ni mapa abierto', source: 'engine', manualHeld: false };

    return automatic;
}

/**
 * The scene behind a number key, or null for anything else.
 *
 * @param {string} key The key as the browser reports it.
 * @returns {SceneName|null}
 */
export function sceneForShortcut(key) {
    const found = SWITCHABLE_SCENES.find(scene => SCENE_INFO[scene].shortcut === String(key));
    return found || null;
}

/**
 * Como se llama una escena **ahora mismo**.
 *
 * Una pestaña fija que pone «Combate» cuando no hay ningún combate promete algo que no
 * existe, y pulsarla parece invocarlo. Sin pelea eso no es el combate: es el tablero, que
 * es donde miras la sala, abres puertas y te colocas antes de que empiece nada.
 *
 * @param {SceneName} scene
 * @param {GameSituation} situation
 * @returns {string}
 */
export function labelFor(scene, situation) {
    const info = SCENE_INFO[scene];
    if (!info) return '';

    if (scene === SCENE.COMBAT && !(situation || {}).combatActive) return 'Tablero';
    return info.label;
}

/**
 * One line for the switcher tooltip: what the scene is and whether it has anything to show.
 *
 * @param {SceneName} scene
 * @param {GameSituation} situation
 * @returns {string}
 */
export function describeScene(scene, situation) {
    const info = SCENE_INFO[scene];
    if (!info) return '';
    const key = info.shortcut ? ` [${info.shortcut}]` : '';
    if (isSceneAvailable(scene, situation)) return `${labelFor(scene, situation)}${key}`;

    // Por que esta apagada importa: "nada que mostrar" y "espera a que acabe la pelea"
    // piden cosas distintas de quien lo lee.
    const held = scene === SCENE.EXPLORATION
        ? holdDuringCombat({ active: Boolean((situation || {}).combatActive) }, 'exploration')
        : '';
    return `${labelFor(scene, situation)}${key} — ${held || 'nada que mostrar todavia'}`;
}

/**
 * Whether the automatic decision changed between two situations.
 *
 * H1 switches scenes by hand; H3 will call this on every engine event to decide whether
 * the screen should follow. Having it here, pure and tested, is what keeps that step from
 * becoming a pile of conditions inside an event handler.
 *
 * @param {GameSituation} before
 * @param {GameSituation} after
 * @returns {SceneName|null} The scene to move to, or null to stay put.
 */
export function sceneTransition(before, after) {
    const from = chooseScene(before).scene;
    const to = chooseScene(after).scene;
    return from === to ? null : to;
}

/**
 * The events that move the screen on their own.
 *
 * These are not "the automatic scene changed": a fight ending with the board still open
 * leaves `chooseScene` on the board, and yet the screen has to go back to the
 * conversation, because what comes next is the epilogue and the epilogue is narration.
 * So the transitions are named, one by one, instead of derived.
 *
 * @typedef {'combat_started'|'combat_ended'|'board_opened'|'board_closed'} SceneEvent
 */

/** What each event means, for the tooltip and for the tests. */
const EVENT_REASONS = {
    combat_started: 'empieza un combate',
    combat_ended: 'termina el combate',
    board_opened: 'se ha abierto un tablero',
    board_closed: 'se ha salido del tablero',
};

/**
 * What happened between two situations, if anything worth changing the screen for.
 *
 * Only one event per step, in order of importance: a fight starting outranks the board
 * that opened underneath it.
 *
 * @param {GameSituation|null} before
 * @param {GameSituation} after
 * @returns {SceneEvent|null}
 */
export function detectSceneEvent(before, after) {
    // Nothing to compare against, or no game open: the situation decides by itself.
    if (!before || !after?.hasChat || !before.hasChat) return null;

    if (!before.combatActive && after.combatActive) return 'combat_started';
    if (before.combatActive && !after.combatActive) return 'combat_ended';

    const had = Boolean(before.boardName);
    const has = Boolean(after.boardName);
    if (!had && has) return 'board_opened';
    if (had && !has) return 'board_closed';

    return null;
}

/**
 * Where an event sends the screen, given what is available.
 *
 * @param {SceneEvent} event
 * @param {GameSituation} situation
 * @returns {SceneName}
 */
function sceneForEvent(event, situation) {
    switch (event) {
        case 'combat_started':
        case 'board_opened':
            return SCENE.COMBAT;
        case 'combat_ended':
            // The epilogue is narration, and narration belongs in the conversation.
            return SCENE.DIALOGUE;
        case 'board_closed':
            return isSceneAvailable(SCENE.EXPLORATION, situation) ? SCENE.EXPLORATION : SCENE.DIALOGUE;
        default:
            return SCENE.DIALOGUE;
    }
}

/**
 * The director proper: decide the scene from what changed, not only from what is.
 *
 * An event beats a manual pick, and then **becomes** the standing pick: otherwise the
 * screen would snap back on the very next redraw — a fight that ends sends you to the
 * epilogue, and the open board would pull you straight back to the table.
 *
 * The player still has the last word: pressing a key sets the dial again, and it holds
 * until the next thing happens in the game.
 *
 * @param {GameSituation|null} previous The situation at the last decision.
 * @param {GameSituation} situation
 * @param {SceneName|null} [manual] The scene the player picked, if any.
 * @returns {SceneChoice & {override: SceneName|null, event: SceneEvent|null}}
 */
export function directScene(previous, situation, manual = null) {
    const event = detectSceneEvent(previous, situation);

    if (event) {
        const scene = sceneForEvent(event, situation);
        return {
            scene,
            reason: EVENT_REASONS[event],
            source: 'engine',
            manualHeld: false,
            override: scene,
            event,
        };
    }

    const choice = chooseScene(situation, manual);
    return { ...choice, override: choice.manualHeld ? manual : null, event: null };
}
