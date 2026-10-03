/**
 * The scene director: which screen the game should be showing.
 *
 * Pure. It receives what the *engine* knows about the game and returns a scene name and
 * the reason for it. No DOM, no jQuery, no reading of globals, so every rule below is a
 * test rather than something you have to reproduce by playing.
 *
 * It deliberately did NOT read the state of the dynamic-context-manager, whose
 * combat/exploration/social machine was decided by the *model*: it guessed from its own prose
 * and a tool let it set the state outright. A line of scene-setting saying "everyone, roll
 * initiative" would jump to the combat screen with no combat behind it. Since the U1 of
 * wiki/ROADMAP_PEGAMENTO.md it is the other way round: that module asks the engine
 * (`getEngineSceneState` in party.js), and the guessing is gone.
 *
 * See wiki/archivo/PROPUESTA_FRONTEND_MODO_JUEGO.md, secciones 0.1 y 2 · wiki/ROADMAP.md, Fase H (H1).
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
 * @property {number} [townPlaces] Cuántos sitios tiene el pueblo donde está el grupo (la
 *           herrería, la posada, el gremio…): con alguno, aunque no haya a donde viajar, hay
 *           a donde ir (J3.11).
 * @property {boolean} [offline] J18.8: una partida sin conexión (el gremio y sus campañas). Sin
 *           pestañas: la escena cambia solo por lo que pasa.
 * @property {string} [chatId] El chat abierto. Sin conexión, pasar a otro (del gremio a una
 *           campaña) es abrir partida.
 * @property {string} [story] La marca de la última línea que se cuenta (no las notas pequeñas
 *           del motor). Sin conexión, que cambie es que hay algo nuevo que leer.
 * @property {{kind: 'story'|'next'|'board'|'place', title: string}|null} [afterFight] D-J45: recién
 *           ganada una pelea en un tablero, a dónde sigue el hilo (`game-engine/combat/after-fight.js`).
 * @property {boolean} [fightWaiting] Directo a la decisión (Daniel, 2026-10-03): en el tablero
 *           abierto espera una pelea que empieza sola en cuanto se ve (os han visto y aún no se ha
 *           abierto en esta visita), o se está decidiendo o colocando (`party/fight-entry.js`).
 * @property {boolean} [novelNews] Sin conexión: si la novela tiene algo nuevo por leer (lo que se
 *           acaba de contar, o el final de una pelea) y aún no se ha seguido con «Continuar». Lo que
 *           había antes de una charla en su ventana cuenta como leído al acabarla.
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
    title: { label: 'Título', icon: 'fa-flag', shortcut: '' },
    dialogue: { label: 'Diálogo', icon: 'fa-comments', shortcut: '1' },
    exploration: { label: 'Exploración', icon: 'fa-map', shortcut: '2' },
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
            // sola localidad y sin mapa, esa pestaña abria un mapa de un punto. Los sitios
            // del pueblo cuentan (J3.11): en el gremio, la herrería y la posada son a donde ir.
            return Boolean(state.hasWorldMap) || Number(state.placeCount) > 1 || Number(state.townPlaces) > 0;
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
 * @typedef {'game_opened'|'combat_started'|'combat_ended'|'board_opened'|'board_closed'|'story_told'} SceneEvent
 */

/** What each event means, for the tooltip and for the tests. */
const EVENT_REASONS = {
    game_opened: 'empieza la partida',
    combat_started: 'empieza un combate',
    combat_ended: 'termina el combate',
    board_opened: 'se ha abierto un tablero',
    board_closed: 'se ha salido del tablero',
    story_told: 'hay algo nuevo que leer',
};

/** Directo a la decisión: por qué se va al tablero sin pasar por la novela (`fightComesFirst`). */
const FIGHT_FIRST_REASON = 'os han visto: empieza la pelea';

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
    if (!before || !after?.hasChat) return null;

    // Una partida que se abre (nueva o cargada) empieza leyendo al narrador, que es quien
    // te sitúa: plantado en un tablero, sin saber aún dónde estás ni por qué, era empezar
    // la película por la mitad (Gem director de UX, 2026-09-27). Cerrarla no es un suceso:
    // sin partida, el título lo decide solo.
    if (!before.hasChat) return 'game_opened';
    // J18.8: sin conexión, pasar a otro chat (del gremio a una campaña, o de vuelta) también es
    // abrir partida, aunque entre medias no se haya visto el título.
    const chatOf = (/** @type {GameSituation} */ s) => String(s.chatId ?? '').trim();
    if (after.offline && chatOf(before) && chatOf(after) && chatOf(before) !== chatOf(after)) return 'game_opened';

    if (!before.combatActive && after.combatActive) return 'combat_started';
    if (before.combatActive && !after.combatActive) return 'combat_ended';

    // J18.8: sin conexión, lo nuevo que se cuenta se lee en la novela, también si llega al entrar
    // en un tablero o al salir de él: se lee y «Continuar» lleva a donde se esté. En una pelea,
    // no: la pelea no se deja a medias para leer.
    if (after.offline && !after.combatActive && after.story && after.story !== before.story) return 'story_told';

    const had = Boolean(before.boardName);
    const has = Boolean(after.boardName);
    // Un tablero que aparece a la vez que el sitio, desde ninguna parte, es el juego
    // colocándote al empezar (`enterStartingBoard`), no alguien que entra en él: es parte de
    // abrir la partida, y la pantalla se queda en la conversación. Entrar en un tablero de
    // verdad se hace estando ya en un sitio.
    if (!had && has && !before.locationName && after.locationName) return null;
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
        case 'game_opened':
            return SCENE.DIALOGUE;
        case 'combat_started':
        case 'board_opened':
            return SCENE.COMBAT;
        case 'combat_ended':
        case 'story_told':
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
    // Directo a la decisión: la novela sin nada que leer no se pone delante de una pelea que
    // empieza sola. Va el tablero, y en él sale la decisión (`fightComesFirst`).
    const first = fightComesFirst(situation);

    if (event) {
        const told = sceneForEvent(event, situation);
        // Lo nuevo que se cuenta (y el final de una pelea) se lee: solo abrir la partida no tiene
        // nada que leer delante.
        const scene = first && event === 'game_opened' && told === SCENE.DIALOGUE ? SCENE.COMBAT : told;
        return {
            scene,
            reason: scene === told ? EVENT_REASONS[event] : FIGHT_FIRST_REASON,
            source: 'engine',
            manualHeld: false,
            override: scene,
            event,
        };
    }

    const choice = chooseScene(situation, manual);
    if (first && choice.scene === SCENE.DIALOGUE) {
        return { scene: SCENE.COMBAT, reason: FIGHT_FIRST_REASON, source: 'engine', manualHeld: false, override: SCENE.COMBAT, event: null };
    }
    return { ...choice, override: choice.manualHeld ? manual : null, event: null };
}

/**
 * Directo a la decisión (Daniel, 2026-10-03: «este menú sigue apareciendo justo tras la
 * conversación, no le veo sentido»). Acabada una charla, si lo siguiente es una pelea que empieza
 * sola (la decisión, colocarse y la iniciativa: `party/fight-entry.js`), la novela vacía, con
 * «Continuar», «Salir del tablero» y «Buscar trampas», sobraba: la ventana de la decisión ya es
 * lo que se hace antes de pelear. Entonces va el tablero, y la decisión sale sola.
 *
 * Solo sin conexión, sin pelea en marcha y si la novela no tiene nada nuevo por leer
 * (`novelNews`): lo que se acaba de contar se lee, y «Continuar» lleva a la pelea como siempre
 * (con las ventanas de historia apagadas, la escena se cuenta así). Tras huir, la pelea ya se abrió
 * en esta visita (`fightWaiting` es falso): se lee cómo acabó, con «Salir del tablero» a mano.
 *
 * @param {GameSituation} situation
 * @returns {boolean}
 */
export function fightComesFirst(situation) {
    const state = situation || {};
    return Boolean(state.hasChat && state.offline && state.fightWaiting && state.boardName && !state.combatActive && !state.novelNews);
}

/**
 * J18.8: a dónde lleva «Continuar» después de leer. A donde se está: al tablero si se está en
 * uno (o hay pelea), y si no, al pueblo o al mapa, si hay a donde ir. Sin nada de eso, la
 * conversación es la casa y no hay a donde continuar.
 *
 * @param {GameSituation} situation
 * @returns {SceneName|null}
 */
export function continueScene(situation) {
    const state = situation || {};
    if (!state.hasChat) return null;
    if (state.combatActive) return SCENE.COMBAT;
    // D-J45: recién ganada una pelea, el hilo manda. Una escena o un suceso se quedan en la
    // novela (salen encima); lo siguiente de la campaña, o el sitio, fuera del tablero.
    const after = state.afterFight?.kind;
    if (after === 'story') return SCENE.DIALOGUE;
    if ((after === 'next' || after === 'place') && isSceneAvailable(SCENE.EXPLORATION, state)) return SCENE.EXPLORATION;
    if (state.boardName) return SCENE.COMBAT;
    return isSceneAvailable(SCENE.EXPLORATION, state) ? SCENE.EXPLORATION : null;
}
