/**
 * The Game Shell: the full-screen layer the game is played in.
 *
 * What it does *not* do is build a second copy of the interface. The tactical board, the
 * initiative tracker, the combat log and the objectives already exist and already draw
 * themselves into `#world_location_maps_list`; the shell picks that whole panel up, puts
 * it on a full-screen stage, and puts it back untouched when it closes. A copy would be a
 * second thing to keep in step with the first, and it would drift.
 *
 * The same reasoning applies to the chat in H2: `#sheld` gets moved, not replicated.
 *
 * It can be switched off. That is not a nicety: this is the first layer of the project
 * that is presentation, the layer least covered by tests and most exposed to an upstream
 * merge. While the shell is closed the application is exactly the one that was there
 * before it existed, and closing it has to leave the DOM exactly as it found it.
 *
 * See wiki/archivo/PROPUESTA_FRONTEND_MODO_JUEGO.md, H1 · wiki/ROADMAP.md, Fase H.
 */

import {
    SCENE, SWITCHABLE_SCENES, SCENE_INFO,
    directScene, isSceneAvailable, describeScene, sceneForShortcut, labelFor, continueScene,
} from './scene-director.js';
import { cleanNovelCopy, markEngineTags } from './engine-tags.js';
import { noteProse } from '../../campaign/narration-prose.js';
import { playForScene, stopSceneAudio } from './scene-audio.js';
import { SHORTCUTS, actionForKey } from './shortcuts.js';
import { firstArt, isPlainFace, loadPixelManifest, openPack } from '../pixel-art.js';
import { faceElement } from '../hero-face.js';
import { buildTown, closeTownPlace, countTownPlaces, renderTownScene, renderTownSelector } from './town-scene.js';
import { deadlineBadge } from '../story-book.js';
import { shownName, shownText } from '../shown-names.js';
// H10 de las vueltas: sin portada mientras se pasa del gremio a una campaña (y de vuelta).
import { isChatSwitching, onChatSwitchEnd } from './chat-switch.js';
// J15.5: el juego con el teclado solo (flechas, Tab en círculo, el foco que vuelve) y J20.6: las
// animaciones que pide el aparato.
import { captureFocus, closeTopOverlay, focusList, holdFocus, installKeyboard, nameIconButtons, restoreFocus, topDialog } from '../keyboard-nav.js';
import { applyMotion, watchMotion } from '../motion.js';
// Tanda 10: la barra de acciones de D&D 2024, flotando sobre el tablero.
import { renderCombatActionBar, releaseCombatActionBar } from '../combat-vtt/action-bar.js';

/**
 * @typedef {import('./scene-director.js').SceneName} SceneName
 * @typedef {import('./scene-director.js').GameSituation} GameSituation
 */

/**
 * One enemy the current actor can reach, as the action bar needs it.
 *
 * @typedef {Object} ShellTarget
 * @property {string} name
 * @property {string} detail Distance, hit points and armour class, already in words.
 */

/**
 * What the action bar shows. Everything here is read from the engine at draw time; the
 * shell keeps none of it.
 *
 * @typedef {Object} CombatBar
 * @property {boolean} active Whether an encounter is running.
 * @property {number} round
 * @property {string} turnLabel Whose turn it is, in words.
 * @property {string} movement Movement left, in words, or empty when it does not apply.
 * @property {boolean} isPlayerTurn Whether the buttons should do anything at all.
 * @property {boolean} hasAction Whether the action of the turn is still unspent.
 * @property {ShellTarget[]} targets Enemies in reach of the current actor.
 * @property {string[]} [intents] A por quien va cada enemigo, una linea por enemigo.
 * @property {boolean} [canAuto] Si el turno es de un compañero que puede jugar la maquina (idea 18).
 */

/**
 * Everything the shell needs from the game, injected so this file holds no game logic.
 *
 * @typedef {Object} ShellOptions
 * @property {() => GameSituation} getSituation
 * @property {() => CombatBar} getCombatBar
 * @property {() => import('./dialogue-scene.js').DialogueView} getDialogue
 * @property {() => string} [narratorName] Quien narra la partida: en la novela visual cuenta, no sale pintado.
 * @property {() => import('./exploration-scene.js').ExplorationView} getExploration
 * @property {(boardName: string) => void} onEnterBoard
 * @property {(locationName: string) => void} onTravel
 * @property {() => void} onOptions Open SillyTavern's own settings, where they are.
 * @property {() => void} onRules El editor de reglas de la campaña.
 * @property {() => void} [onCompendium] La biblioteca de contenido, desde el menú.
 * @property {() => void} [onExport] Empaquetar la campana para compartirla.
 * @property {() => void} [onCheckWorld] Si el mundo llega al listón (idea 181).
 * @property {() => void} [onShareWorld] El código del mundo, para compartirlo (idea 180).
 * @property {() => void} [onWorkshop] El taller del mundo (ideas 175, 176, 183 y 185).
 * @property {() => void} [onEditCampaign] El editor del mundo y sus localidades.
 * @property {() => void} [onAudio] Los ajustes de sonido.
 * @property {() => void} onMainMenu Leave the campaign, without leaving the game.
 * @property {() => void} renderStage Redraw the panel that lives on the stage.
 * @property {(name: string) => void} onAttack
 * @property {() => {bar: import('../combat-vtt/action-menus.js').BarView, menu: (id: string, filter?: string) => import('../combat-vtt/action-menus.js').MenuView|null}} [getActionBar]
 *   Tanda 10: la barra de D&D 2024 y sus menús (`party/combat-bar.js`).
 * @property {(pick: string) => ({keepOpen?: string}|void)} [onBarPick] Tanda 10: lo que pasa al pulsar algo de ella.
 * @property {() => void} onEndTurn
 * @property {() => void} onFlee
 * @property {() => void} [onParley] J8.5: salir de la pelea hablando (entregarse, sobornar, convencer o engañar).
 * @property {() => boolean} [canParley] Si ahora se puede: en el turno de uno de los tuyos.
 * @property {() => void} onObjectives
 * @property {() => import('./clock-widget.js').ClockView} [getClock] El dia y lo que deja hacer.
 * @property {(action: 'slot'|'day'|'short'|'long') => void} [onClock] Pasar el tiempo o descansar.
 * @property {(limit?: number) => import('./action-chips.js').ActionChip[]} [getChips] Lo que se puede hacer sin
 *   escribirlo; con `limit`, cuántas caben (`Infinity`, todas).
 * @property {(chip: import('./action-chips.js').ActionChip) => void} [onChip]
 * @property {(next: SceneName, seen?: GameSituation) => (SceneName|null|void)} [onContinue] D-J45: «Continuar» tras ganar
 *   una pelea sigue el hilo; lo que haga falta antes (salir del tablero) lo hace el juego, que
 *   dice a qué escena se va (sin decirlo, a `next`). `seen`: lo que la pantalla tenía en cuenta
 *   al ofrecerlo (con los sitios del pueblo, que el juego no cuenta).
 * @property {(memberId: string) => void} [onCompanion] Abrir la ficha de un companero.
 * @property {() => void} [onNewCampaign] Empezar una partida desde el menu principal.
 * @property {() => void} [onOffline] J4: jugar sin conexión, una partida nueva en un gremio.
 * @property {() => import('../../campaign/saved-games.js').GameCard[]|null} [getGames] J0.6: las
 *   partidas guardadas (un gremio con sus campañas, o una campaña suelta), la última jugada
 *   primero; null mientras se leen.
 * @property {(id: string) => void} [onLoadGame] J0.5 y J0.6: seguir una partida donde se quedó.
 * @property {(id: string) => void} [onDeleteGame] J0.6: borrar una partida (pregunta antes).
 * @property {() => void} [onSaveGame] J15.2: la pantalla de guardar y cargar, con la partida abierta (en la pausa).
 * @property {(id: string) => string} [slotsLine] J15.2: «2 ranuras guardadas» de una partida, o nada.
 * @property {(id: string) => void} [onGameSlots] J15.2: las ranuras de una partida, desde «Cargar partida».
 * @property {() => void} [onImportGame] J15.6: meter una partida exportada, desde «Cargar partida».
 * @property {() => number} [countHall] Cuantos caidos hay en el salon de la fama (idea 199).
 * @property {() => string} [hallHint] Lo que hay en el salon, dicho corto (J3.9): «1 campaña terminada · 2 caídos».
 * @property {() => void} [onHall] Abrir el salon de la fama.
 * @property {() => boolean} [getAutostart] Si el juego se abre solo al arrancar.
 * @property {(value: boolean) => void} [setAutostart]
 * @property {() => Array<{id: string, label: string, detail: string, enabled: boolean, needsAlly: boolean, allies: Array<{id: string, name: string}>}>} [getAbilities]
 *   Las habilidades sobre uno mismo o sobre un aliado, ya juzgadas.
 * @property {(abilityId: string, allyId?: string) => void} [onAbility]
 * @property {() => Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, needsTarget: boolean, targets: Array<{id: string, name: string}>}>} [getManeuvers]
 *   Esquivar, destrabarse, empujar y ayudar, ya juzgadas.
 * @property {(maneuverId: string, targetId?: string) => void} [onManeuver]
 * @property {() => Array<{id: string, label: string, icon: string, detail: string, enabled: boolean}>} [getChecks]
 *   Las tiradas de habilidad que se pueden intentar fuera de combate.
 * @property {(skill: string) => void} [onCheck]
 * @property {() => void} [onAskNarrator] El botón «Al narrador»: lo próximo que se escriba es para él.
 * @property {() => boolean} [isAskingNarrator] Si está puesto.
 * @property {() => boolean} [canAskNarrator] Si se ofrece ahora: en combate, no.
 * @property {() => Array<{id: string, label: string, icon: string, actions: Array<{id: string, label: string, detail: string, enabled: boolean, cost?: number}>}>} [getServices]
 *   Los servicios de aqui, con lo que se puede hacer en cada uno.
 * @property {(actionId: string) => void} [onService]
 * @property {() => ({location: any, npcs: any[], people?: import('./town-scene.js').YourPerson[]}|null)} [getTown] J3.11: la
 *   localización de aquí y la gente del mundo, para los sitios del pueblo. Sin ella, el Shell las lee
 *   del mundo abierto. J14.4: y quién de tu gente está en cada sitio (`people`).
 * @property {() => {title: string, hint: string, act: number, clock?: import('../../campaign/story-book.js').BookClock|null}|null} [getFocus]
 *   J9.5: con `clock`, el plazo de lo que tenéis entre manos («Queda 1 día»).
 *   Lo que se tiene entre manos: el hito abierto del hilo.
 * @property {() => void} [onJournal] Abrir el diario (idea 100).
 * @property {() => void} [onGlance] El grupo de un vistazo (idea 162).
 * @property {() => number} [getNoticeCount] Avisos sin ver (idea 159).
 * @property {() => void} [onTray] Abrir la bandeja de avisos.
 * @property {() => void} [onAutoTurn] Que el compañero de turno actue solo (idea 18).
 * @property {() => void} [onDice] El historial de dados (idea 168).
 * @property {(mode: string) => void} [onRetry] Rehacer la ultima respuesta (idea 150).
 * @property {() => boolean} [canRetry] Si hay modelo que la rehaga: sin él, los botones no salen.
 * @property {() => void} [onGlossary] El glosario (idea 156).
 * @property {(scene: string) => void} [onScene] Al cambiar de escena: el consejo de la primera vez (idea 155).
 * @property {(scene: string) => void} [onSceneTime] Cada cambio de escena, también al título y al
 *   cerrar el juego (`out`): el diario de sesión cuenta los minutos (U0 del pegamento).
 * @property {() => void} [onSession] Tu sesión: minutos, mensajes y llamadas (U0 del pegamento).
 * @property {() => void} [onHowToPlay] H2 de wiki/LO_QUE_FALTA.md: «Cómo se juega».
 * @property {() => void} [onWeekTable] La mesa de la semana (U5 del pegamento).
 * @property {() => void} [onTextMap] El mapa en texto, con niebla y notas (ideas 69 y 70).
 * @property {(scene: string) => string} [audioSceneFor] Qué suena en una escena, según dónde se esté (idea 187).
 * @property {() => Array<{id: string, label: string, on: boolean}>} [getToggles] Los interruptores
 *   del menu de pausa: modo ahorro, largo de la narracion, daltonismo (ideas 148, 149 y 172).
 * @property {(id: string) => void} [onToggle]
 * @property {() => {text: string, title: string, high: boolean}|null} [getMeter] Lo que costo el ultimo turno.
 * @property {() => void} [onMeter] El desglose del prompt.
 * @property {() => void} [onHelp] Lo que se puede hacer aqui y ahora (idea 136).
 * @property {() => void} [onClose] Anything the game wants undone when the shell closes.
 * @property {(message: string) => void} [notify]
 */

/** The panel with the board and everything drawn beside it. */
const BOARD_SELECTOR = '#world_location_maps_row';

/**
 * The chat. `#sheld` carries `#chat` and `#form_sheld` together, with their streaming,
 * their swipes and their handlers, so moving the pair is the only way to have a working
 * conversation inside a scene. Rebuilding it would mean rebuilding all of that.
 */
const CHAT_SELECTOR = '#sheld';

/**
 * The scenes that exist. The switcher announces the rest instead of faking them.
 * @type {Set<SceneName>}
 */
const BUILT_SCENES = new Set([SCENE.COMBAT, SCENE.DIALOGUE, SCENE.EXPLORATION, SCENE.TITLE]);

/** @type {HTMLElement|null} */
let root = null;
/** Everything the shell borrowed from the page, and where each piece goes back. */
/** @type {{ parent: Node, marker: Comment, element: HTMLElement }[]} */
let adoptions = [];
/** @type {ShellOptions|null} */
let options = null;
/** @type {SceneName|null} */
let manualScene = null;
/** Whether the pause menu is up. While it is, SillyTavern's own bar comes back. */
let paused = false;
/**
 * The situation at the last decision. The director compares against it to tell a fight
 * starting from a fight that was already going.
 * @type {GameSituation|null}
 */
let lastSituation = null;
/**
 * Why the screen is where it is. Kept between redraws: the epilogue of a fight arrives
 * as a message, the message triggers a redraw, and that redraw would otherwise rewrite
 * "termina el combate" into "elegida a mano" — which is not what happened.
 */
let sceneReason = '';
/** @type {((event: KeyboardEvent) => void)|null} */
let keyHandler = null;
/** J15.5: para quitar el teclado del juego y el vigía de «reducir movimiento» al cerrar. @type {(() => void)|null} */
let keyboardOff = null;
/** @type {(() => void)|null} */
let motionOff = null;
/** J15.5: al quitar la pausa, el foco vuelve a lo que la abrió. @type {(() => void)|null} */
let pauseReturn = null;
/**
 * Mide la cabecera para que los avisos flotantes caigan justo debajo (`--gs-head-bottom` en
 * game-shell.css). Su alto cambia con lo que lleva: la misión, el reloj, cuántos botones.
 * @type {ResizeObserver|null}
 */
let headWatcher = null;
/**
 * Que ensena la pantalla de titulo: el menu, o la lista de partidas guardadas.
 *
 * Empezar en la lista — como hacia antes — es empezar en medio: lo primero que ve alguien
 * que abre el juego deberia ser que puede empezar una, seguir una o cambiar las opciones.
 * @type {'menu'|'load'}
 */
let titleView = 'menu';
/**
 * J18.7 y J18.8: si la partida abierta es sin conexión (el gremio y sus campañas). Entonces no
 * hay caja de escribir, ni pestañas de escena, ni la X: la escena cambia por lo que se hace y
 * se sale desde la pausa. Lo dice la situación en cada redibujo.
 */
let offline = false;
/**
 * Mira el chat mientras el juego está abierto: sin conexión, una línea nueva es algo que leer,
 * y la pantalla tiene que enterarse aunque quien la cuenta no avise al Modo Juego.
 * @type {MutationObserver|null}
 */
let chatWatcher = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let chatRedraw = null;

/** @returns {boolean} */
export function isShellOpen() {
    return root !== null && root.isConnected;
}

/**
 * Build one element with a class and optional text.
 *
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * A button, typed as one: the disabled state is half of what the action bar says.
 *
 * @param {string} className
 * @returns {HTMLButtonElement}
 */
function makeButton(className) {
    const node = document.createElement('button');
    node.className = className;
    node.type = 'button';
    return node;
}

/**
 * Borrow a piece of the page and put it on the stage, remembering exactly where it came
 * from. A comment node stays behind in its place, so putting it back is an insertion at a
 * known point rather than a guess about which child index it used to be.
 *
 * Borrowed, never copied: the board and the chat are the real ones, with their handlers,
 * their state and their scroll. A copy would be a second thing to keep in step.
 *
 * @param {string} selector
 * @param {HTMLElement} target Where on the stage it goes.
 * @returns {HTMLElement|null}
 */
function adopt(selector, target) {
    const panel = /** @type {HTMLElement|null} */ (document.querySelector(selector));
    if (!panel || !panel.parentNode) return null;

    const marker = document.createComment(`game-shell: ${selector} vuelve aqui`);
    panel.parentNode.insertBefore(marker, panel);
    adoptions.push({ parent: panel.parentNode, marker, element: panel });
    target.appendChild(panel);
    panel.classList.add('gs-adopted');
    return panel;
}

/** Put everything back where it was, in reverse order of borrowing, and forget it. */
function releaseAll() {
    for (const { parent, marker, element } of adoptions.reverse()) {
        element.classList.remove('gs-adopted');
        if (marker.parentNode) {
            marker.parentNode.insertBefore(element, marker);
            marker.parentNode.removeChild(marker);
        } else {
            // The marker is gone, which means something else rewrote that part of the
            // page. Putting the panel back at the end of its old parent beats losing it.
            parent.appendChild(element);
        }
    }
    adoptions = [];
}

/** The chat keeps its scroll only if somebody puts it back at the bottom after a move. */
function scrollChatDown() {
    const chat = document.querySelector('#chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
}

/**
 * Draw the scene switcher. A scene with nothing behind it stays on screen but disabled,
 * so the player can see it exists and why it is not available.
 *
 * @param {HTMLElement} bar
 * @param {GameSituation} situation
 * @param {SceneName} current
 */
function renderSwitcher(bar, situation, current) {
    bar.textContent = '';
    // J18.8: sin conexión no hay pestañas. Se pasa a otra escena haciendo algo: entrar en un
    // tablero, empezar una pelea, «Continuar» al acabar de leer.
    if (offline) return;
    for (const scene of SWITCHABLE_SCENES) {
        const info = SCENE_INFO[scene];
        const button = makeButton('gs-scene-btn');
        button.dataset.scene = scene;
        button.title = describeScene(scene, situation);
        button.appendChild(el('i', `fa-solid ${info.icon}`));
        button.appendChild(el('span', 'gs-scene-label', labelFor(scene, situation)));
        button.appendChild(el('kbd', 'gs-scene-key', info.shortcut));
        if (scene === current) button.classList.add('active');
        const built = BUILT_SCENES.has(scene);
        if (!built || !isSceneAvailable(scene, situation)) {
            button.disabled = true;
            if (!built) button.title = `${labelFor(scene, situation)} — la construye el paso siguiente del Modo Juego`;
        }
        button.addEventListener('click', () => setScene(scene));
        bar.appendChild(button);
    }
}

/**
 * El menu principal: lo primero que se ve al abrir el juego.
 *
 * Cuatro cosas y una puerta de salida. La puerta importa tanto como las cuatro: debajo de
 * esta capa sigue estando SillyTavern entero, y esconderlo seria mentir sobre lo que es
 * esto. El compendio va antes que las opciones porque es contenido, no ajustes.
 *
 * @param {HTMLElement} menu
 */
function renderTitleMenu(menu) {
    menu.textContent = '';
    menu.dataset.view = titleView;
    const games = options?.getGames?.() ?? null;

    if (titleView === 'load') {
        const back = makeButton('gs-menu-back');
        back.appendChild(el('i', 'fa-solid fa-arrow-left'));
        back.appendChild(el('span', '', ' Volver al menu'));
        back.addEventListener('click', () => {
            titleView = 'menu';
            refreshGameShell();
        });
        menu.appendChild(back);
        renderSavedGames(menu, games);
        return;
    }

    /**
     * @param {string} label
     * @param {string} icon
     * @param {string} hint
     * @param {() => void} action
     */
    const item = (label, icon, hint, action) => {
        const button = makeButton('gs-menu-btn');
        button.appendChild(el('i', `fa-solid ${icon}`));
        const body = el('span', 'gs-menu-body');
        body.appendChild(el('span', 'gs-menu-label', label));
        if (hint) body.appendChild(el('span', 'gs-menu-hint', hint));
        button.appendChild(body);
        button.addEventListener('click', action);
        menu.appendChild(button);
    };

    const saved = games?.length ?? 0;

    // J0.5: lo último que se jugó, de un clic, sea un gremio o una campaña suelta; y la línea
    // dice qué se sigue. Cubre lo que hacía «Seguir en el gremio» con el gremio más reciente;
    // los demás gremios están en «Cargar partida», como todo lo demás.
    const last = games?.find(game => !game.unstarted);
    if (last && options?.onLoadGame) {
        item('Continuar', 'fa-play', last.resume, () => options?.onLoadGame?.(last.id));
    }
    // J4 de ROADMAP_SIN_CONEXION: jugar sin conexión, antes que empezar otra.
    if (options?.onOffline) {
        item('Jugar sin conexión', 'fa-dungeon', 'Tu personaje, un gremio y campañas escritas. Sin IA: lo cuenta el juego.',
            () => options?.onOffline?.());
    }
    item('Partida nueva', 'fa-wand-sparkles', 'Desde cero, un mundo hecho o un libro',
        () => options?.onNewCampaign?.());
    item('Cargar partida', 'fa-folder-open',
        games === null ? 'Buscando tus partidas…' : saved === 1 ? '1 partida guardada' : `${saved} partidas guardadas`,
        () => {
            titleView = 'load';
            refreshGameShell();
        });
    // La biblioteca no necesita partida abierta: es tuya, no de una campana.
    if (options?.onCompendium) {
        item('Compendio', 'fa-book-open', 'Tu biblioteca: armas, bichos, gente, nombres',
            () => options?.onCompendium?.());
    }
    // Idea 199: los caidos de todas las partidas; y desde J3.9, las campañas terminadas. Solo
    // si ya hay alguien (o alguna) en el salon.
    const fallen = options?.countHall?.() ?? 0;
    if (fallen > 0 && options?.onHall) {
        item('Salón de la fama', 'fa-monument', options?.hallHint?.() || (fallen === 1 ? '1 caído' : `${fallen} caídos`),
            () => options?.onHall?.());
    }
    // J0.4: las opciones del juego (texto, colores, sonido, quién cuenta), no las de SillyTavern.
    item('Opciones', 'fa-sliders', 'Texto, colores, sonido y quién cuenta',
        () => options?.onOptions());

    const leave = makeButton('gs-menu-leave');
    leave.textContent = 'Salir al SillyTavern de siempre';
    leave.addEventListener('click', () => closeGameShell());
    menu.appendChild(leave);
}

/**
 * J0.6: «Cargar partida» enseña partidas, no chats. Antes se veía la bienvenida de
 * SillyTavern tal cual —su logo, sus chats recientes con el nombre del narrador, su
 * asistente—; ahora cada partida es una tarjeta del juego con lo que hace falta para elegir:
 * dónde se quedó, quién va y a qué nivel, y cuándo se jugó. Pulsarla la sigue.
 *
 * @param {HTMLElement} menu
 * @param {import('../../campaign/saved-games.js').GameCard[]|null} games
 */
function renderSavedGames(menu, games) {
    menu.appendChild(el('div', 'gs-load-title', 'Tus partidas'));
    const list = el('div', 'gs-saves');
    if (games === null) {
        list.appendChild(el('div', 'gs-saves-empty', 'Buscando tus partidas…'));
    } else if (games.length === 0) {
        list.appendChild(el('div', 'gs-saves-empty',
            'Todavía no hay ninguna partida guardada. Empieza una con «Jugar sin conexión» o «Partida nueva».'));
    }
    for (const game of games ?? []) {
        const card = el('div', `gs-save${game.unstarted ? ' gs-save-unstarted' : ''}`);
        card.dataset.game = game.id;
        card.dataset.world = game.id;
        card.dataset.kind = game.kind;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.title = game.unstarted ? `Empezar «${game.title}»` : `Seguir «${game.title}»`;
        card.appendChild(el('i', `fa-solid ${game.icon} gs-save-icon`));

        const body = el('div', 'gs-save-body');
        const top = el('div', 'gs-save-top');
        top.appendChild(el('span', 'gs-save-title', game.title));
        if (game.badge) top.appendChild(el('span', 'gs-save-badge', game.badge));
        if (game.when) top.appendChild(el('span', 'gs-save-when', `Jugada ${game.when}`));
        body.appendChild(top);
        // J15.2: cuántas ranuras tiene guardadas; se cargan desde su botón.
        const slots = game.unstarted ? '' : String(options?.slotsLine?.(game.id) ?? '');
        for (const [key, value] of /** @type {const} */ ([['hero', game.hero], ['line', game.line], ['where', game.where], ['campaigns', game.campaigns], ['slots', slots]])) {
            if (value) body.appendChild(el('div', `gs-save-${key}`, value));
        }
        card.appendChild(body);

        const actions = el('div', 'gs-save-actions');
        const play = makeButton('gs-save-play');
        play.appendChild(el('i', 'fa-solid fa-play'));
        play.appendChild(el('span', '', game.unstarted ? ' Empezar' : ' Seguir'));
        actions.appendChild(play);
        if (slots && options?.onGameSlots) {
            const load = makeButton('gs-save-load');
            load.title = `Las ranuras de «${game.title}»: cargar una de ellas`;
            load.dataset.world = game.id;
            load.appendChild(el('i', 'fa-solid fa-floppy-disk'));
            load.appendChild(el('span', '', ' Ranuras'));
            load.addEventListener('click', (event) => {
                event.stopPropagation();
                options?.onGameSlots?.(game.id);
            });
            actions.appendChild(load);
        }
        if (game.canDelete && options?.onDeleteGame) {
            const bin = makeButton('gs-save-delete');
            // D-J23: un gremio se borra entero, con sus campañas; la ventana de antes lo dice todo.
            bin.title = game.kind === 'gremio' ? 'Borrar este gremio, con sus campañas' : 'Borrar esta partida';
            bin.dataset.world = game.id;
            bin.appendChild(el('i', 'fa-solid fa-trash'));
            bin.addEventListener('click', (event) => {
                event.stopPropagation();
                options?.onDeleteGame?.(game.id);
            });
            actions.appendChild(bin);
        }
        card.appendChild(actions);

        // Toda la tarjeta sigue la partida; la papelera no, que para eso para el clic.
        card.addEventListener('click', () => options?.onLoadGame?.(game.id));
        card.addEventListener('keydown', (event) => {
            if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            options?.onLoadGame?.(game.id);
        });
        list.appendChild(card);
    }
    menu.appendChild(list);
    // J15.6: una partida exportada (de otro ordenador, o de antes), con todo dentro.
    if (options?.onImportGame) {
        const bring = makeButton('gs-menu-btn gs-save-import');
        bring.appendChild(el('i', 'fa-solid fa-file-import'));
        const body = el('span', 'gs-menu-body');
        body.appendChild(el('span', 'gs-menu-label', 'Importar una partida'));
        body.appendChild(el('span', 'gs-menu-hint', 'Un archivo «.partida.json» exportado desde este juego'));
        bring.appendChild(body);
        bring.addEventListener('click', () => options?.onImportGame?.());
        menu.appendChild(bring);
    }
}

/**
 * Una imagen para `background-image` desde una variable de CSS. La ruta va entera: dentro de
 * una variable, `url()` se leería desde la carpeta de la hoja de estilos (`css/img/…`).
 *
 * @param {string} art
 * @returns {string}
 */
function cssUrl(art) {
    return art ? `url("${new URL(art, document.baseURI).href}")` : 'none';
}

/**
 * Un dibujo en pixel delante de una fila de lista (el bicho al que se apunta, la habilidad).
 * Sin dibujo, o si no carga, la fila se queda como estaba.
 *
 * @param {HTMLElement} row
 * @param {string} art
 */
function appendArt(row, art) {
    if (!art) return;
    const image = document.createElement('img');
    image.className = 'gs-target-art pixel-art';
    image.src = art;
    image.alt = '';
    image.addEventListener('error', () => image.remove());
    row.appendChild(image);
}

/**
 * El rótulo de una lista (a quién atacar, habilidades, maniobras, tiradas) y su cruz. La cruz
 * solo se ve en el móvil (J20.1): allí la lista sube desde abajo como una hoja y tapa el botón
 * que la abrió, que era la única forma de cerrarla.
 *
 * @param {HTMLElement} list
 * @param {string} text
 */
function listTitle(list, text) {
    const title = el('div', 'gs-targets-title', text);
    const close = makeButton('gs-targets-close');
    close.title = 'Cerrar';
    close.setAttribute('aria-label', 'Cerrar');
    close.appendChild(el('i', 'fa-solid fa-xmark'));
    close.addEventListener('click', () => list.remove());
    title.appendChild(close);
    list.appendChild(title);
}

/**
 * La lista de habilidades propias, con el mismo gesto que la de objetivos.
 *
 * Una que necesita aliado pregunta a quien: elegir persona es elegir, y decidirlo por ti
 * convertiria una curacion en un boton tonto.
 *
 * @param {HTMLElement} footer
 * @param {Array<any>} abilities
 */
function toggleAbilities(footer, abilities) {
    const open = footer.querySelector('.gs-abilities');
    if (open) {
        open.remove();
        return;
    }

    const list = el('div', 'gs-targets gs-abilities');
    listTitle(list, 'Lo que sabes hacer');

    for (const ability of abilities) {
        const row = makeButton('gs-target');
        appendArt(row, firstArt('ability', { id: ability.id, name: ability.label }));
        row.appendChild(el('span', 'gs-target-name', ability.label));
        row.appendChild(el('span', 'gs-target-detail', ability.detail));
        row.disabled = !ability.enabled;
        row.title = ability.detail;
        row.addEventListener('click', () => {
            if (!ability.needsAlly) {
                list.remove();
                options?.onAbility?.(ability.id);
                return;
            }

            // Sobre un aliado: la misma lista, un paso mas adentro.
            list.textContent = '';
            listTitle(list, `${ability.label} \u2014 \u00bfsobre quien?`);
            for (const ally of ability.allies) {
                const pick = makeButton('gs-target');
                pick.appendChild(el('span', 'gs-target-name', ally.name));
                pick.addEventListener('click', () => {
                    list.remove();
                    options?.onAbility?.(ability.id, ally.id);
                });
                list.appendChild(pick);
            }
        });
        list.appendChild(row);
    }

    footer.appendChild(list);
    // J15.5: el foco, a la primera; al cerrarla, vuelve a «Habilidades».
    focusList(list);
}

/**
 * La lista de maniobras, con el mismo gesto que la de habilidades.
 *
 * Empujar y ayudar preguntan a quien, entre los que tienes pegados: son los unicos a los
 * que se puede.
 *
 * @param {HTMLElement} footer
 * @param {Array<any>} maneuvers
 */
function toggleManeuvers(footer, maneuvers) {
    const open = footer.querySelector('.gs-maneuvers');
    if (open) {
        open.remove();
        return;
    }

    const list = el('div', 'gs-targets gs-maneuvers');
    listTitle(list, 'En vez de pegar');

    for (const maneuver of maneuvers) {
        const row = makeButton('gs-target');
        row.dataset.maneuver = maneuver.id;
        row.appendChild(el('span', 'gs-target-name', maneuver.label));
        row.appendChild(el('span', 'gs-target-detail', maneuver.detail));
        row.disabled = !maneuver.enabled;
        row.title = maneuver.detail;
        row.addEventListener('click', () => {
            if (!maneuver.needsTarget) {
                list.remove();
                options?.onManeuver?.(maneuver.id);
                return;
            }
            list.textContent = '';
            listTitle(list, `${maneuver.label} — ¿a quien?`);
            for (const target of maneuver.targets) {
                const pick = makeButton('gs-target');
                pick.appendChild(el('span', 'gs-target-name', target.name));
                pick.addEventListener('click', () => {
                    list.remove();
                    options?.onManeuver?.(maneuver.id, target.id);
                });
                list.appendChild(pick);
            }
        });
        list.appendChild(row);
    }

    footer.appendChild(list);
    focusList(list);
}

/**
 * Draw the row of things that can be done without typing them.
 *
 * Cada ficha sale del estado, asi que ninguna ofrece algo que luego no pase. La que abre
 * una puerta gasta — puede despertar una sala —, y por eso es un boton; la de hablar solo
 * deja el texto empezado en el chat, porque lo que se diga lo decide quien juega.
 *
 * Sin conexión (J18.7, J18.8) no sale «Al narrador», que es escribirle al modelo; y en la novela
 * va delante «Continuar», que lleva a donde se esté al acabar de leer. La misma fila va al pie
 * del pueblo y del tablero, sin lo que esas pantallas ya tienen a la vista (`skip`).
 *
 * @param {HTMLElement} row
 * @param {{next?: SceneName|null, situation?: GameSituation, skip?: (chip: import('./action-chips.js').ActionChip) => boolean}} [place]
 *   `next`: a dónde lleva «Continuar», si se ofrece.
 */
function renderActionChips(row, place = {}) {
    if (!options?.getChips) {
        row.textContent = '';
        return;
    }

    const chips = options.getChips().filter(chip => !place.skip?.(chip));
    const checks = options?.getChecks?.() ?? [];
    // «Al narrador», fuera de combate: en combate manda la barra de combate. Sin conexión, nunca.
    const narrator = !offline && Boolean(options?.onAskNarrator) && options?.canAskNarrator?.() !== false;
    const next = place.next ?? null;
    row.textContent = '';
    row.classList.toggle('gs-chips-empty', chips.length === 0 && checks.length === 0 && !narrator && !next);

    // J18.8: después de leer, seguir. Lo primero de la fila, en dorado: en el móvil la fila se
    // desliza y lo del final no se ve.
    if (next) {
        const go = makeButton('gs-chip-action gs-chip-motor gs-chip-continue');
        go.dataset.next = next;
        const board = String(place.situation?.boardName || '');
        const here = String(place.situation?.locationName || '');
        // D-J45: tras ganar, a dónde sigue el hilo (una escena, lo siguiente de la campaña…).
        go.title = place.situation?.afterFight?.title
            || (next === SCENE.COMBAT ? `Volver al tablero${board ? `: ${board}` : ''}` : `Seguir en ${here || 'el mapa'}`);
        if (place.situation?.afterFight?.kind) go.dataset.after = place.situation.afterFight.kind;
        go.appendChild(el('span', 'gs-chip-action-label', 'Continuar'));
        go.appendChild(el('i', 'fa-solid fa-arrow-right'));
        go.addEventListener('click', () => {
            // Leído el final de la pelea, su tarjeta de victoria sobra: en el tablero tapaba su
            // botón de salir, sobre todo en el móvil.
            document.querySelectorAll('.vs-card').forEach(card => card.remove());
            // D-J45: el juego decide con lo de ahora (la escena de después puede haber acabado).
            setScene(options?.onContinue?.(next, place.situation) || next);
        });
        row.appendChild(go);
    }

    for (const chip of chips) {
        const button = makeButton(`gs-chip-action gs-chip-${chip.source}`);
        // De qué ficha es (`look:…`, `talk-local:…`), para las vueltas de prueba.
        button.dataset.chip = chip.id;
        // Sin conexión no hay caja ni órdenes: el porqué es la ficha misma (J18.7).
        button.title = chip.command && !offline
            ? `Ejecuta ${chip.command}`
            : (chip.draft && !offline ? 'Deja la frase empezada en el chat' : chip.label);
        button.appendChild(el('i', `fa-solid ${chip.icon}`));
        button.appendChild(el('span', 'gs-chip-action-label', chip.label));
        button.addEventListener('click', () => options?.onChip?.(chip));
        row.appendChild(button);
    }

    // Intentar algo: el dado lo tira el motor y el narrador lee el resultado ya decidido.
    if (checks.length > 0) {
        const button = makeButton('gs-chip-action gs-chip-motor gs-chip-check');
        button.title = 'El motor tira el dado; el narrador solo lee el resultado';
        button.appendChild(el('i', 'fa-solid fa-dice-d20'));
        button.appendChild(el('span', 'gs-chip-action-label', 'Tirada'));
        button.addEventListener('click', () => toggleChecks(row, checks));
        row.appendChild(button);
    }

    // Hablar con el narrador directamente, fuera de la escena: lo que escribas en la caja
    // sin esto lo contesta quien tienes delante (2026-09-28).
    if (narrator) {
        const button = makeButton('gs-chip-action gs-chip-motor gs-chip-narrator');
        button.title = 'Lo próximo que escribas va al narrador, fuera de la escena: «¿qué puedo hacer?», «¿qué sé de esto?»';
        button.classList.toggle('on', Boolean(options.isAskingNarrator?.()));
        button.appendChild(el('i', 'fa-solid fa-feather-pointed'));
        button.appendChild(el('span', 'gs-chip-action-label', 'Al narrador'));
        button.addEventListener('click', () => options?.onAskNarrator?.());
        row.appendChild(button);
    }
}

/**
 * La lista de tiradas, encima de la fila de fichas.
 *
 * @param {HTMLElement} row
 * @param {Array<any>} checks
 */
function toggleChecks(row, checks) {
    const open = row.querySelector('.gs-checks');
    if (open) {
        open.remove();
        return;
    }

    const list = el('div', 'gs-targets gs-checks');
    listTitle(list, 'Intentarlo: el dado decide, no la prosa');
    for (const check of checks) {
        const pick = makeButton('gs-target');
        pick.dataset.check = check.id;
        pick.appendChild(el('span', 'gs-target-name', check.label));
        pick.appendChild(el('span', 'gs-target-detail', check.detail));
        pick.disabled = !check.enabled;
        pick.title = check.detail;
        pick.addEventListener('click', () => {
            list.remove();
            options?.onCheck?.(check.id);
        });
        list.appendChild(pick);
    }
    row.appendChild(list);
}

/**
 * Lo que tienes entre manos, siempre a la vista.
 *
 * Una linea: el hito abierto y su pista. Es la respuesta a «empiezo y no se que hacer», y
 * por eso no se esconde en ningun menu.
 *
 * @param {HTMLElement|null} slot
 * @param {HTMLElement|null} [tools] Donde van los botones (el diario, la mesa…).
 */
function renderFocus(slot, tools = null) {
    if (!slot) return;
    slot.textContent = '';
    if (tools) tools.textContent = '';
    const focus = options?.getFocus?.() ?? null;
    slot.classList.toggle('gs-focus-empty', !focus);
    if (focus) {
        slot.appendChild(el('i', 'fa-solid fa-compass'));
        // J13.7: sin nombrar a quien aún no se ha presentado.
        slot.appendChild(el('span', 'gs-focus-title', shownText(focus.title, { mask: true })));
        if (focus.hint) slot.appendChild(el('span', 'gs-focus-hint', shownText(focus.hint, { mask: true })));
        // J9.5: si tiene plazo, cuánto queda, junto a lo que tenéis entre manos.
        const clock = focus.clock ? deadlineBadge(focus.clock) : null;
        if (clock) slot.appendChild(clock);
        slot.title = focus.act ? `Acto ${focus.act}` : '';
    }
    // Siempre a mano, aunque la fila de fichas este llena: el diario y la ayuda.
    const buttons = el('span', 'gs-guide');
    if (options?.onJournal) {
        const journal = makeButton('gs-guide-btn gs-journal');
        journal.appendChild(el('i', 'fa-solid fa-book'));
        journal.appendChild(el('span', '', ' Diario'));
        journal.title = 'Lo que sabéis: el hilo, las pistas, lo que habéis oído';
        journal.addEventListener('click', () => options?.onJournal?.());
        buttons.appendChild(journal);
    }
    // U5 del pegamento: la semana en una mesa.
    if (options?.onWeekTable) {
        const table = makeButton('gs-guide-btn gs-table');
        table.appendChild(el('i', 'fa-solid fa-table-list'));
        table.appendChild(el('span', '', ' Mesa'));
        table.title = 'La semana: los asuntos que no caben todos, cómo os ven y lo que viene';
        table.addEventListener('click', () => options?.onWeekTable?.());
        buttons.appendChild(table);
    }
    // Ideas 69 y 70: el mapa, en texto.
    if (options?.onTextMap) {
        const map = makeButton('gs-guide-btn gs-map');
        map.appendChild(el('i', 'fa-solid fa-map'));
        map.appendChild(el('span', '', ' Mapa'));
        map.title = 'Los sitios y sus caminos: lo no visitado en gris, y tus notas';
        map.addEventListener('click', () => options?.onTextMap?.());
        buttons.appendChild(map);
    }
    if (options?.onGlance) {
        const glance = makeButton('gs-guide-btn gs-glance');
        glance.appendChild(el('i', 'fa-solid fa-users'));
        glance.appendChild(el('span', '', ' Grupo'));
        glance.title = 'Vida, heridas, hambre, oro y vínculo de todos';
        glance.addEventListener('click', () => options?.onGlance?.());
        buttons.appendChild(glance);
    }
    if (options?.onTray) {
        const tray = makeButton('gs-guide-btn gs-tray');
        tray.appendChild(el('i', 'fa-solid fa-bell'));
        const count = options?.getNoticeCount?.() ?? 0;
        tray.appendChild(el('span', 'gs-tray-count', count > 0 ? String(count) : ''));
        tray.title = 'Los últimos avisos, para no perderlos';
        // J15.5: con solo la campana y un número, el lector de pantalla decía «4».
        tray.setAttribute('aria-label', count > 0 ? `Avisos: ${count}` : 'Avisos');
        // Y el número cambia al leerlos: el foco lo reconoce por esto al redibujar (keyboard-nav).
        tray.dataset.guide = 'tray';
        tray.addEventListener('click', () => options?.onTray?.());
        buttons.appendChild(tray);
    }
    if (options?.onDice) {
        const dice = makeButton('gs-guide-btn gs-dice');
        dice.appendChild(el('i', 'fa-solid fa-dice-d20'));
        dice.title = 'El historial de dados: ¿el dado me odia?';
        dice.setAttribute('aria-label', 'Historial de dados');
        dice.addEventListener('click', () => options?.onDice?.());
        buttons.appendChild(dice);
    }
    if (options?.onHelp) {
        const help = makeButton('gs-guide-btn gs-help');
        help.appendChild(el('i', 'fa-solid fa-circle-question'));
        help.appendChild(el('span', '', ' ¿Qué hago?'));
        help.title = 'Todo lo que se puede hacer aquí y ahora';
        help.addEventListener('click', () => options?.onHelp?.());
        buttons.appendChild(help);
    }
    // Idea 147: lo que cuesta cada turno, siempre a la vista.
    const meter = options?.getMeter?.() ?? null;
    if (meter) {
        const tokens = makeButton('gs-guide-btn gs-meter');
        tokens.classList.toggle('gs-meter-high', meter.high);
        tokens.appendChild(el('i', 'fa-solid fa-coins'));
        tokens.appendChild(el('span', '', ` ${meter.text}`));
        tokens.title = meter.title;
        tokens.addEventListener('click', () => options?.onMeter?.());
        buttons.appendChild(tokens);
    }
    if (buttons.childElementCount > 0) (tools ?? slot).appendChild(buttons);
}

/**
 * Draw the clock: the day, the part of the day, and the four things that spend time.
 *
 * Descansar vivia en la pestana de Campana del cajon del grupo, o sea fuera de la
 * partida. Un boton apagado se queda a la vista con el motivo en el `title`: esconderlo
 * haria creer que descansar no existe, cuando lo que pasa es que ahora no toca.
 *
 * @param {HTMLElement} clock
 */
function renderClock(clock) {
    if (!options?.getClock) {
        clock.textContent = '';
        return;
    }

    const view = options.getClock();
    clock.textContent = '';
    // El día y la parte del día, y aparte la estación: en el móvil solo cabe lo primero (D-J38).
    const main = [`Día ${view.day}`, view.slot].filter(Boolean).join(' · ');
    const label = el('span', 'gs-clock-label', view.label.startsWith(main) ? main : view.label);
    if (view.label.startsWith(main) && view.label.length > main.length) {
        label.appendChild(el('span', 'gs-clock-season', view.label.slice(main.length)));
    }
    label.title = view.label;
    clock.appendChild(label);

    // J14.2: las partes del día, una marca por parte: la que ya se fue (y en qué), la de ahora
    // y las que quedan libres. Lo que se hizo, al pasar el ratón y en el móvil al tocar.
    if (view.strip?.length > 0) {
        const strip = el('span', 'gs-day-strip');
        strip.title = view.stripLine;
        strip.setAttribute('aria-label', view.stripLine);
        for (const part of view.strip) {
            const mark = el('span', `gs-day-part gs-day-${part.state}`);
            mark.dataset.part = part.id;
            mark.title = part.state === 'hecho' ? `${part.label}: ${part.what || 'pasada'}` : `${part.label}: ${part.state === 'ahora' ? 'ahora' : 'libre'}`;
            mark.appendChild(el('span', 'gs-day-part-name', part.label));
            if (part.state === 'hecho' && part.what) mark.appendChild(el('span', 'gs-day-part-what', part.what));
            strip.appendChild(mark);
        }
        clock.appendChild(strip);
    }

    // J18.9: sin conexión, descansar y pasar el tiempo son cosas que se hacen en un sitio (dormir
    // en la posada, acampar fuera), no botones de la cabecera: el reloj solo dice el día.
    if (offline) return;
    for (const action of view.actions) {
        const button = makeButton('gs-clock-btn');
        button.title = action.why;
        button.disabled = !action.enabled;
        button.appendChild(el('i', `fa-solid ${action.icon}`));
        button.appendChild(el('span', 'gs-clock-btn-label', action.label));
        button.addEventListener('click', () => options?.onClock?.(action.id));
        clock.appendChild(button);
    }
}

/**
 * Draw the action bar under the board.
 *
 * The buttons are the commands that already exist, with the typing taken out: attacking
 * asks for a target from the list of who is actually in reach instead of expecting a name
 * spelled exactly right.
 *
 * @param {HTMLElement} footer
 * @param {CombatBar} bar
 */
function renderActionBar(footer, bar) {
    // Tanda 10: en plena pelea, la barra de D&D 2024 que flota abajo, con sus menús de grimorio
    // (`combat-vtt/action-bar.js`). La de abajo de este archivo queda para cuando no la hay.
    if (bar.active && options?.getActionBar && options.onBarPick) {
        const pick = options.onBarPick;
        renderCombatActionBar(footer, options.getActionBar(), {
            onPick: (id) => pick(id),
            onEndTurn: () => options?.onEndTurn(),
            onFlee: () => options?.onFlee(),
            ...(options.onAutoTurn ? { onAutoTurn: () => options?.onAutoTurn?.() } : {}),
        });
        return;
    }
    releaseCombatActionBar(footer);
    footer.textContent = '';

    if (!bar.active) {
        footer.appendChild(el('div', 'gs-actions-idle',
            'Sin combate. El tablero esta en modo inspeccion: arrastra a los tuyos para colocarlos.'));
        return;
    }

    const status = el('div', 'gs-actions-status');
    status.appendChild(el('span', 'gs-turn-label', bar.turnLabel));
    if (bar.movement) status.appendChild(el('span', 'gs-move-label', bar.movement));
    footer.appendChild(status);

    // Lo que van a hacer: se reacciona a algo que se ve (esquivar, ayudar, apartarse).
    if (bar.intents && bar.intents.length > 0) {
        const intents = el('div', 'gs-intents');
        intents.appendChild(el('i', 'fa-solid fa-eye'));
        intents.appendChild(el('span', '', ` ${bar.intents.join(' · ')}`));
        intents.title = 'Lo que haría cada enemigo si le tocase ahora';
        footer.appendChild(intents);
    }

    const buttons = el('div', 'gs-actions-buttons');

    const attack = makeButton('gs-btn gs-btn-attack');
    attack.appendChild(el('i', 'fa-solid fa-hand-fist'));
    attack.appendChild(el('span', '', ' Atacar'));
    attack.disabled = !bar.isPlayerTurn || !bar.hasAction || bar.targets.length === 0;
    attack.title = !bar.isPlayerTurn ? 'No es tu turno'
        : !bar.hasAction ? 'La accion de este turno ya esta gastada'
            : bar.targets.length === 0 ? 'No hay enemigos a tu alcance'
                : 'Elegir objetivo';
    attack.addEventListener('click', () => toggleTargets(footer, bar));
    buttons.appendChild(attack);

    // Idea 18: el turno de un compañero, con su postura, sin mover sus fichas a mano.
    if (bar.canAuto && options?.onAutoTurn) {
        const auto = makeButton('gs-btn gs-btn-auto');
        auto.appendChild(el('i', 'fa-solid fa-robot'));
        auto.appendChild(el('span', '', ' Que actúe solo'));
        auto.title = 'Juega su turno con la postura y la preferencia de su ficha';
        auto.addEventListener('click', () => options?.onAutoTurn?.());
        buttons.appendChild(auto);
    }

    const endTurn = makeButton('gs-btn gs-btn-end');
    endTurn.appendChild(el('i', 'fa-solid fa-forward'));
    endTurn.appendChild(el('span', '', ' Fin de turno'));
    endTurn.disabled = !bar.isPlayerTurn;
    endTurn.title = bar.isPlayerTurn ? 'Pasar el turno' : 'No es tu turno';
    endTurn.addEventListener('click', () => options?.onEndTurn());
    buttons.appendChild(endTurn);

    // Las que van sobre un enemigo viven en su tarjeta, que es donde se elige a quien.
    // Aqui solo las de uno mismo y las de aliado, que no tienen tablero que pulsar.
    const own = options?.getAbilities?.() ?? [];
    if (own.length > 0) {
        const abilities = makeButton('gs-btn gs-btn-abilities');
        abilities.appendChild(el('i', 'fa-solid fa-wand-sparkles'));
        abilities.appendChild(el('span', '', ' Habilidades'));
        abilities.disabled = !bar.isPlayerTurn;
        abilities.title = bar.isPlayerTurn ? 'Lo que sabes hacer' : 'No es tu turno';
        abilities.addEventListener('click', () => toggleAbilities(footer, own));
        buttons.appendChild(abilities);
    }

    // Lo que se hace en vez de pegar. Antes solo se podia *contar* en el chat.
    const maneuvers = options?.getManeuvers?.() ?? [];
    if (maneuvers.length > 0) {
        const button = makeButton('gs-btn gs-btn-maneuvers');
        button.appendChild(el('i', 'fa-solid fa-person-rays'));
        button.appendChild(el('span', '', ' Maniobras'));
        button.disabled = !bar.isPlayerTurn;
        button.title = bar.isPlayerTurn ? 'Esquivar, destrabarse, empujar, ayudar' : 'No es tu turno';
        // Se vuelven a pedir al pulsar: el tablero cambia entre medias (una caja que arde o se
        // rompe) y la lista de cuando se pintó la barra ya no vale.
        button.addEventListener('click', () => toggleManeuvers(footer, options?.getManeuvers?.() ?? maneuvers));
        buttons.appendChild(button);
    }

    const objectives = makeButton('gs-btn');
    objectives.appendChild(el('i', 'fa-solid fa-list-check'));
    objectives.appendChild(el('span', '', ' Objetivos'));
    objectives.addEventListener('click', () => options?.onObjectives());
    buttons.appendChild(objectives);

    // J8.5: salir de la pelea hablando, con su ventana.
    if (options?.onParley) {
        const talk = makeButton('gs-btn gs-btn-parley');
        talk.appendChild(el('i', 'fa-solid fa-comments'));
        talk.appendChild(el('span', '', ' Hablar'));
        const can = options?.canParley?.() ?? bar.isPlayerTurn;
        talk.disabled = !can;
        talk.title = can ? 'Entregarse, sobornar, convencer o engañar' : 'No es tu turno';
        talk.addEventListener('click', () => options?.onParley?.());
        buttons.appendChild(talk);
    }

    const flee = makeButton('gs-btn gs-btn-quiet');
    flee.appendChild(el('i', 'fa-solid fa-person-running'));
    flee.appendChild(el('span', '', ' Abandonar'));
    flee.addEventListener('click', () => options?.onFlee());
    buttons.appendChild(flee);

    footer.appendChild(buttons);
}

/**
 * Open or close the list of reachable enemies.
 *
 * @param {HTMLElement} footer
 * @param {CombatBar} bar
 */
function toggleTargets(footer, bar) {
    const open = footer.querySelector('.gs-targets');
    if (open) {
        open.remove();
        return;
    }

    const list = el('div', 'gs-targets');
    listTitle(list, 'A tu alcance');
    for (const target of bar.targets) {
        const row = makeButton('gs-target');
        appendArt(row, firstArt('creature', { name: target.name }));
        row.appendChild(el('span', 'gs-target-name', target.name));
        row.appendChild(el('span', 'gs-target-detail', target.detail));
        row.addEventListener('click', () => {
            list.remove();
            options?.onAttack(target.name);
        });
        list.appendChild(row);
    }
    footer.appendChild(list);
    focusList(list);
}


/**
 * Draw the portrait, the bond rank and the party strip. The conversation itself is the
 * chat, moved in below: nothing here prints a line that the chat already shows.
 *
 * @param {HTMLElement} scene
 * @param {import('./dialogue-scene.js').DialogueView} view
 */
function renderDialogue(scene, view) {
    const speaker = /** @type {HTMLElement} */ (scene.querySelector('.gs-speaker'));
    speaker.textContent = '';

    if (view.speaker) {
        const portrait = el('div', 'gs-portrait');
        if (view.speaker.avatar) {
            const image = document.createElement('img');
            image.src = view.speaker.avatar;
            image.alt = view.speaker.name;
            portrait.appendChild(image);
        } else {
            portrait.appendChild(el('i', 'fa-solid fa-comment-dots'));
        }
        speaker.appendChild(portrait);

        const who = el('div', 'gs-speaker-who');
        who.appendChild(el('div', 'gs-speaker-name', shownName(view.speaker.name)));
        if (view.speaker.rankLabel) {
            who.appendChild(el('div', 'gs-speaker-rank', view.speaker.rankLabel));
        }
        speaker.appendChild(who);
        // Idea 150: rehacer la ultima respuesta, igual, mas corta o con mas nervio.
        // Sin modelo no hay respuesta que rehacer: los botones no salen (ROADMAP_SIN_TOKENS, Z0).
        if (options?.onRetry && (options.canRetry?.() ?? true)) {
            const retry = el('div', 'gs-retry');
            for (const [mode, label, icon] of [['otra', 'Otra vez', 'fa-rotate'], ['corto', 'Más corto', 'fa-compress'], ['intenso', 'Más intenso', 'fa-fire']]) {
                const button = makeButton('gs-retry-btn');
                button.dataset.retry = mode;
                button.appendChild(el('i', `fa-solid ${icon}`));
                button.appendChild(el('span', '', ` ${label}`));
                button.title = 'Rehace la última respuesta del narrador';
                button.addEventListener('click', () => options?.onRetry?.(mode));
                retry.appendChild(button);
            }
            speaker.appendChild(retry);
        }
    } else {
        speaker.appendChild(el('div', 'gs-speaker-empty', 'Nadie ha dicho nada todavia.'));
    }

    renderChips(/** @type {HTMLElement} */ (scene.querySelector('.gs-party-strip')), view.party);
}

/** Lo que se lee en la caja: los últimos mensajes desde lo último que dijiste, como mucho. */
const NOVEL_LINES = 4;

/** J0.4: lo que ya salió en la caja, para que al redibujar solo entre lo nuevo. */
let novelShown = new Set();

/** J20.6: si la caja ya tiene pedido bajar hasta lo último en el siguiente fotograma, y cuál. */
let novelScrollPending = false;
/** @type {HTMLElement|null} */
let novelScrollTarget = null;

/**
 * Los botones que cuelgan de la caja: el registro entero y esconderla para ver la escena.
 *
 * @returns {HTMLElement}
 */
function buildNovelControls() {
    const controls = el('div', 'gs-vn-controls');
    const log = makeButton('gs-vn-control gs-vn-log-btn');
    log.appendChild(el('i', 'fa-solid fa-clock-rotate-left'));
    log.appendChild(el('span', '', 'Registro'));
    log.title = 'Todo lo dicho hasta ahora, y la caja para escribir';
    log.addEventListener('click', () => {
        const open = !root?.classList.contains('gs-vn-log');
        root?.classList.toggle('gs-vn-log', open);
        log.querySelector('span').textContent = open ? 'Cerrar registro' : 'Registro';
        if (open) scrollChatDown();
    });
    const hide = makeButton('gs-vn-control gs-vn-hide-btn');
    hide.appendChild(el('i', 'fa-solid fa-eye-slash'));
    hide.appendChild(el('span', '', 'Ocultar UI'));
    hide.title = 'Ver la escena sin la caja';
    hide.addEventListener('click', () => {
        const hidden = !root?.classList.contains('gs-vn-hidden');
        root?.classList.toggle('gs-vn-hidden', hidden);
        hide.querySelector('span').textContent = hidden ? 'Mostrar' : 'Ocultar UI';
        hide.querySelector('i').className = `fa-solid ${hidden ? 'fa-eye' : 'fa-eye-slash'}`;
    });
    controls.appendChild(log);
    controls.appendChild(hide);
    return controls;
}

/**
 * J13.1: una nota del motor (`postCombatNarration`) que se guardó sin su versión contada
 * (`extra.display_text`), contada para la caja con `noteProse`. Nada si ya se lee como prosa.
 *
 * @param {Element} node El `.mes` del chat.
 * @returns {Element|null}
 */
function engineNoteCopy(node) {
    const message = /** @type {any} */ (globalThis).SillyTavern?.getContext?.()?.chat?.[Number(node.getAttribute('mesid'))];
    if (!message || message.is_user || !message.is_system || message.extra?.display_text) return null;
    const said = String(message.mes ?? '').trim();
    const told = noteProse(said);
    if (!told || told === said) return null;
    const copy = document.createElement('div');
    told.split('\n').forEach((line, i) => {
        if (i > 0) copy.appendChild(document.createElement('br'));
        copy.appendChild(document.createTextNode(line));
    });
    return copy;
}

/**
 * La novela visual (J18.3, J18.4): quien habla en grande, su nombre en la placa y lo último
 * que se ha dicho en la caja. Se lee del chat, que sigue siendo el registro: aquí no se
 * escribe nada que el chat no tenga.
 *
 * Una persona sale con su retrato; si no tiene imagen, con una silueta. Lo que cuenta el
 * juego sale sin retrato, y las notas (la mascota, el combate) sin placa.
 *
 * La gente del paquete (y los mercenarios) sale con su retrato en pixel, y detrás, apagado,
 * el escenario del sitio donde se está.
 *
 * @param {HTMLElement} scene
 * @param {import('./dialogue-scene.js').DialogueView} view
 * @param {string} [place] La localización abierta, para el escenario de fondo.
 */
function renderNovel(scene, view, place = '') {
    // De qué paquete es la partida: se lee una vez por mundo y, al saberse, se redibuja.
    const pack = openPack(() => { if (isShellOpen()) refreshGameShell(); });
    renderBackdrop(scene, place, pack);
    const messages = [...document.querySelectorAll('#chat .mes')];
    let start = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].getAttribute('is_user') === 'true') break;
        start = i;
    }
    // J18.10: lo que se lee es la copia del mensaje sin las etiquetas del motor («[HILO] Hecho:
    // …», «🗣️ [DUELO]»): solo la prosa. Un mensaje que era solo etiqueta no ocupa sitio.
    /** @type {Map<Element, Element>} */
    const copies = new Map();
    const said = (/** @type {Element} */ node) => {
        const body = node.querySelector('.mes_text');
        if (!body || !(body.textContent || '').trim()) return false;
        // J13.1: sin conexión, una nota del motor guardada sin su versión contada (de una partida
        // de antes) se cuenta aquí.
        const copy = (offline && engineNoteCopy(node)) || /** @type {Element} */ (body.cloneNode(true));
        if (!cleanNovelCopy(copy)) return false;
        copies.set(node, copy);
        return true;
    };
    // De atrás adelante, hasta tener las que caben: sin conexión no hay mensajes tuyos, y leer el
    // chat entero en cada redibujo era copiar cien mensajes para enseñar cuatro.
    const lastSaid = (/** @type {Element[]} */ list, /** @type {number} */ count) => {
        /** @type {Element[]} */
        const found = [];
        for (let i = list.length - 1; i >= 0 && found.length < count; i--) {
            if (said(list[i])) found.unshift(list[i]);
        }
        return found;
    };
    let lines = lastSaid(messages.slice(start), NOVEL_LINES);
    if (lines.length === 0) lines = lastSaid(messages.filter(m => m.getAttribute('is_user') !== 'true'), 1);

    const text = /** @type {HTMLElement} */ (scene.querySelector('.gs-vn-text'));
    text.textContent = '';
    const keyOf = (/** @type {Element} */ node) => `${node.getAttribute('mesid')}:${(node.querySelector('.mes_text')?.textContent || '').trim().slice(0, 60)}`;
    let fresh = 0;
    const people = lines.filter(m => m.getAttribute('is_system') !== 'true');
    const last = people[people.length - 1] ?? null;
    const speakerName = (last?.getAttribute('ch_name') || '').trim();
    // «La figura del narrador sobra» (Daniel, 2026-10-01): lo que cuenta quien narra sale sin
    // placa y sin su nombre delante; solo el texto.
    const narratorNow = String(options?.narratorName?.() || '').trim();
    // «Narrador» a secas es el nombre de relleno de lo que cuenta el motor sin ficha delante.
    const isNarrator = (/** @type {string} */ name) => Boolean(name && (name === narratorNow || name === 'Narrador'));
    for (const line of lines) {
        const system = line.getAttribute('is_system') === 'true';
        const who = (line.getAttribute('ch_name') || '').trim();
        const block = el('div', `gs-vn-line${system ? ' gs-vn-note' : ''}`);
        // Cuando en la caja habla más de uno, cada frase dice de quién es (menos el narrador).
        if (!system && who && who !== speakerName && !isNarrator(who)) block.appendChild(el('span', 'gs-vn-who', shownName(who)));
        const body = copies.get(line);
        if (body) block.appendChild(body);
        // Lo nuevo aparece con la velocidad de las opciones (J0.4), una frase tras otra.
        if (!novelShown.has(keyOf(line))) {
            block.classList.add('gs-vn-new');
            block.style.animationDelay = `calc(var(--gs-text-speed, 0s) * ${fresh})`;
            fresh += 1;
        }
        text.appendChild(block);
    }
    novelShown = new Set(lines.map(keyOf));
    // J20.6: hasta lo último, justo antes de pintar. Medir `scrollHeight` aquí obligaba a colocar
    // la página entera a mitad de cada redibujo, y una acción redibuja varias veces.
    novelScrollTarget = text;
    if (!novelScrollPending) {
        novelScrollPending = true;
        requestAnimationFrame(() => {
            novelScrollPending = false;
            if (novelScrollTarget) novelScrollTarget.scrollTop = novelScrollTarget.scrollHeight;
        });
    }

    const portrait = /** @type {HTMLElement} */ (scene.querySelector('.gs-vn-portrait'));
    portrait.textContent = '';
    portrait.classList.remove('gs-vn-drawn');
    const speaking = view.speaker && view.speaker.name === speakerName ? view.speaker : null;
    const avatar = speaking ? speaking.avatar : '';
    const plain = isPlainFace(avatar);
    // El narrador no se pinta: cuenta, no está en la escena. Tampoco lo que cuenta el juego
    // con la cara de sistema de SillyTavern, que es su logo (J0.3).
    const narrator = Boolean(speakerName && isNarrator(speakerName))
        || /(^|\/)img\/five\.png$/i.test(avatar);

    const plate = /** @type {HTMLElement} */ (scene.querySelector('.gs-vn-nameplate'));
    // J13.7: «Posadero» hasta que se presente. Y el narrador, sin placa: solo su texto.
    plate.textContent = narrator ? '' : shownName(speakerName);
    plate.hidden = !speakerName || narrator;
    portrait.hidden = !speakerName || narrator;
    if (portrait.hidden) return;
    const silhouette = () => portrait.appendChild(el('i', 'fa-solid fa-user-secret gs-vn-silhouette'));
    // La cara propia de alguien del grupo manda. Si no, su retrato en pixel si es alguien del
    // paquete o un mercenario: antes que la cara que trae el mensaje, que es la de la ficha
    // que habla por él.
    const own = speaking?.known && !plain ? avatar : '';
    // Con su gesto si la frase lo trae (`extra.mood`: alegre, enfadado, triste) y está dibujado.
    const lastMessage = last ? /** @type {any} */ (globalThis).SillyTavern?.getContext?.()?.chat?.[Number(last.getAttribute('mesid'))] : null;
    const mood = String(lastMessage?.extra?.mood ?? '');
    const drawn = own ? '' : firstArt('portrait', { name: speakerName, pack, mood });
    const shown = own || drawn || (plain ? '' : avatar);
    if (!shown) {
        // D-J52: uno del grupo sin retrato sale con su cara (la que eligió, el retrato de relleno
        // de su clase o sus iniciales), como en la tira; no con la silueta.
        const mate = (view.party ?? []).find(chip => chip.name === speakerName);
        if (mate) {
            const face = faceElement(mate, { imageClass: 'gs-vn-pixel', pixelClass: 'pixel-art', badgeClass: 'gs-vn-face' });
            if (face.tagName === 'IMG') portrait.classList.add('gs-vn-drawn');
            portrait.appendChild(face);
            return;
        }
        silhouette();
        return;
    }
    const image = document.createElement('img');
    image.src = shown;
    image.alt = speakerName;
    if (drawn) {
        image.className = 'pixel-art gs-vn-pixel';
        portrait.classList.add('gs-vn-drawn');
    }
    image.addEventListener('error', () => {
        image.remove();
        portrait.classList.remove('gs-vn-drawn');
        silhouette();
    });
    portrait.appendChild(image);
}

/**
 * Detrás de la conversación, el sitio donde se está, en pixel y apagado: el escenario de su
 * localización en el paquete, de noche si es de noche y lo hay. Sin dibujo, nada.
 *
 * @param {HTMLElement} scene
 * @param {string} place
 * @param {string} pack
 */
function renderBackdrop(scene, place, pack) {
    const backdrop = /** @type {HTMLElement|null} */ (scene.querySelector('.gs-vn-backdrop'));
    if (!backdrop) return;
    const night = /noche/i.test(String(options?.getClock?.()?.slot ?? ''));
    const art = place ? firstArt('scene', { name: place, pack, night }) : '';
    if (backdrop.dataset.art === art) return;
    backdrop.dataset.art = art;
    backdrop.style.setProperty('--gs-vn-backdrop', cssUrl(art));
    backdrop.hidden = !art;
}

/**
 * The party as a row of chips, under whichever scene asked for it.
 *
 * @param {HTMLElement} strip
 * @param {import('./party-strip.js').PartyChip[]} chips
 */
function renderChips(strip, chips) {
    strip.textContent = '';
    for (const chip of chips) {
        // Una cara en la tira es la forma mas corta de llegar a un companero, y hasta
        // ahora no llevaba a ninguna parte: los botones de vinculo estaban en un cajon.
        const card = options?.onCompanion ? makeButton('gs-chip') : el('div', 'gs-chip');
        if (options?.onCompanion) {
            card.title = `Abrir la ficha de ${chip.name}`;
            card.classList.add('gs-chip-clickable');
            card.addEventListener('click', () => options?.onCompanion?.(chip.id));
        }
        card.classList.toggle('fallen', chip.fallen);
        card.classList.toggle('bloodied', chip.bloodied);

        // Sin cara propia, su retrato en pixel: el suyo si es un mercenario, y si no, el de
        // relleno de su clase. J1.8: sin ninguno, o si la imagen no carga, sus iniciales en su
        // color (`hero-face.js`), y no la silueta de SillyTavern ni una imagen rota.
        card.appendChild(faceElement(chip, {
            imageClass: 'gs-chip-avatar', pixelClass: 'gs-chip-pixel pixel-art', badgeClass: 'gs-chip-avatar gs-chip-initials',
        }));

        const body = el('div', 'gs-chip-body');
        const line = el('div', 'gs-chip-line');
        line.appendChild(el('span', 'gs-chip-name', chip.name));
        if (chip.canLevel) {
            const star = el('i', 'gs-chip-level fa-solid fa-star');
            star.title = 'Puede subir de nivel';
            line.appendChild(star);
        }
        for (const status of chip.statuses) {
            const icon = el('i', `gs-chip-status fa-solid ${status.icon}`);
            icon.title = status.label;
            line.appendChild(icon);
        }
        body.appendChild(line);

        const bar = el('div', 'gs-chip-hp');
        const fill = el('div', 'gs-chip-hp-fill');
        fill.style.width = `${chip.hpPct}%`;
        bar.appendChild(fill);
        body.appendChild(bar);
        body.appendChild(el('span', 'gs-chip-hp-text', `${chip.hp}/${chip.maxHp}`));
        if (chip.dying) body.appendChild(el('div', 'gs-chip-dying', chip.dying));

        card.appendChild(body);
        strip.appendChild(card);
    }
}

/**
 * The pause menu.
 *
 * Pausing brings SillyTavern's own top bar back, and that is the whole trick behind
 * "options open the panels as they are": the bar and its drawers already sit above this
 * layer, so nothing has to be moved or rebuilt. The game steps aside; the application is
 * there, exactly as it was.
 *
 * @param {boolean} next
 */
function setPaused(next) {
    if (!root || !options) return;
    paused = next;
    document.body.classList.toggle('game-shell-paused', paused);

    const existing = root.querySelector('.gs-pause');
    if (!paused) {
        // J15.5: lo que tenía el foco se lo lleva la pausa al irse; se devuelve a lo que la abrió.
        const hadFocus = Boolean(existing?.contains(document.activeElement));
        existing?.remove();
        const back = pauseReturn;
        pauseReturn = null;
        if (hadFocus) back?.();
        return;
    }
    if (existing) return;

    // J15.5: la pausa es una ventana: se anuncia como tal, el foco entra en «Continuar» y Tab no
    // sale de ella (`data-trap`, keyboard-nav.js) hasta cerrarla.
    const overlay = el('div', 'gs-pause');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Pausa');
    overlay.dataset.trap = '';
    const card = el('div', 'gs-pause-card');
    card.appendChild(el('div', 'gs-pause-title', 'Pausa'));

    /**
     * @param {string} label
     * @param {string} icon
     * @param {() => void} action
     * @param {string} [hint]
     */
    const item = (label, icon, action, hint) => {
        const button = makeButton('gs-pause-btn');
        button.appendChild(el('i', `fa-solid ${icon}`));
        button.appendChild(el('span', 'gs-pause-label', label));
        if (hint) button.appendChild(el('kbd', 'gs-pause-key', hint));
        button.addEventListener('click', action);
        card.appendChild(button);
    };

    item('Continuar', 'fa-play', () => setPaused(false), 'Esc');
    // J15.2: guardar y cargar, como en un juego; solo con una partida abierta.
    if (options.onSaveGame && options.getSituation?.()?.hasChat) {
        item('Guardar y cargar', 'fa-floppy-disk', () => {
            setPaused(false);
            options?.onSaveGame?.();
        });
    }
    // H2: cómo se juega, armado con lo que el motor sabe.
    if (options.onHowToPlay) {
        item('Cómo se juega', 'fa-circle-question', () => {
            setPaused(false);
            options?.onHowToPlay?.();
        });
    }
    item('Opciones', 'fa-sliders', () => options?.onOptions());
    item('Reglas del juego', 'fa-scale-balanced', () => options?.onRules());
    // U0 del pegamento: en qué se ha ido esta sesión.
    if (options.onSession) {
        item('Tu sesión', 'fa-hourglass-half', () => {
            setPaused(false);
            options?.onSession?.();
        });
    }
    if (options.onEditCampaign) {
        item('Editar la campaña', 'fa-map-location-dot', () => {
            setPaused(false);
            options?.onEditCampaign?.();
        });
    }
    if (options.onExport) {
        item('Exportar la campaña', 'fa-file-export', () => {
            setPaused(false);
            options?.onExport?.();
        });
    }
    // Idea 181: lo que le falta al mundo, con el encargo para el Gem.
    if (options.onCheckWorld) {
        item('¿Llega al listón?', 'fa-list-check', () => {
            setPaused(false);
            options?.onCheckWorld?.();
        });
    }
    // Ideas 175, 176, 183 y 185: el taller del mundo.
    if (options.onWorkshop) {
        item('Taller del mundo', 'fa-screwdriver-wrench', () => {
            setPaused(false);
            options?.onWorkshop?.();
        });
    }
    // Idea 180: el código del mundo, para que otro juegue el mismo.
    if (options.onShareWorld) {
        item('Compartir este mundo', 'fa-share-nodes', () => {
            setPaused(false);
            options?.onShareWorld?.();
        });
    }
    if (options.onAudio) {
        item('Sonido', 'fa-music', () => {
            setPaused(false);
            options?.onAudio?.();
        });
    }
    // Ideas 148, 149 y 172: lo que cambia como se juega, sin salir de la partida. En una fila
    // de botones pequeños: como botones grandes, el menu ya no cabia en pantallas bajas.
    const toggles = options.getToggles?.() ?? [];
    if (toggles.length > 0) {
        const row = el('div', 'gs-pause-toggles');
        for (const toggle of toggles) {
            const button = makeButton(`gs-pause-toggle${toggle.on ? ' on' : ''}`);
            button.dataset.toggle = toggle.id;
            button.textContent = toggle.label;
            button.addEventListener('click', () => {
                options?.onToggle?.(toggle.id);
                setPaused(false);
                setPaused(true);
                // J15.5: redibujada la pausa, el foco sigue en el mismo interruptor.
                /** @type {HTMLElement|null} */ (root?.querySelector(`.gs-pause-toggle[data-toggle="${CSS.escape(toggle.id)}"]`) ?? null)?.focus();
            });
            row.appendChild(button);
        }
        card.appendChild(row);
    }
    if (options.getAutostart && options.setAutostart) {
        // La puerta de salida de verdad: apagado, la aplicacion arranca como la de
        // siempre. Un juego que no te deja no jugarlo es un juego que estorba.
        const on = options.getAutostart();
        item(on ? 'No abrir el juego al arrancar' : 'Abrir el juego al arrancar',
            on ? 'fa-toggle-on' : 'fa-toggle-off', () => {
                options?.setAutostart?.(!on);
                setPaused(false);
                setPaused(true);
            });
    }
    item('Salir al menu principal', 'fa-door-open', () => {
        setPaused(false);
        options?.onMainMenu();
    });
    item('Salir del Modo Juego', 'fa-xmark', () => closeGameShell());

    card.appendChild(el('div', 'gs-pause-note',
        'Mientras el juego esta en pausa, la barra de SillyTavern vuelve arriba: sus paneles se abren donde siempre.'));

    overlay.appendChild(card);
    // Clicking outside the card is the other way everyone expects to resume.
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) setPaused(false);
    });
    root.appendChild(overlay);
    pauseReturn = holdFocus(card, /** @type {HTMLElement|null} */ (card.querySelector('.gs-pause-btn')));
}

/**
 * Una columna del panel de Exploración: su rótulo con icono, y lo que lleva.
 *
 * @param {string} icon
 * @param {string} title
 * @param {string} kind
 * @returns {HTMLElement}
 */
function exploreColumn(icon, title, kind) {
    const column = el('section', 'ex-column');
    column.dataset.col = kind;
    const head = el('div', 'gs-places-title ex-col-title');
    head.appendChild(el('i', `fa-solid ${icon}`));
    head.appendChild(el('span', '', title));
    column.appendChild(head);
    return column;
}

/**
 * Una tarjeta de tablero o de sitio: el icono en su cuadro, el nombre y una o dos notas.
 *
 * @param {string} className
 * @param {string} icon
 * @param {string} name
 * @param {string} nameClass
 * @param {string[]} notes `[nota, pendiente]`
 * @returns {HTMLButtonElement}
 */
function exploreCard(className, icon, name, nameClass, notes) {
    const card = makeButton(`gs-card ${className}`);
    const badge = el('span', 'gs-card-icon');
    badge.appendChild(el('i', `fa-solid ${icon}`));
    card.appendChild(badge);
    const body = el('div', 'gs-card-body');
    body.appendChild(el('div', nameClass, name));
    const [note, pending] = notes;
    if (note) body.appendChild(el('div', 'gs-card-note gs-place-note', note));
    if (pending) body.appendChild(el('div', 'gs-place-pending', pending));
    card.appendChild(body);
    return card;
}

/**
 * J18.9: sin conexión, descansar y pasar el tiempo se hacen en un sitio, no desde la cabecera.
 * En la posada, además de dormir (la sala común o una habitación, que ya ofrecía), «Pasar el
 * rato»; donde no hay posada, una tarjeta «Descansar» con el descanso corto y, si se puede,
 * acampar. Son los descansos de siempre (`onClock` y la ficha de acampar): solo cambia dónde
 * se ofrecen. Con conexión, las tarjetas quedan como estaban.
 *
 * @param {Array<{id: string, label: string, icon: string, actions: Array<any>}>} cards
 * @returns {Array<{id: string, label: string, icon: string, actions: Array<any>}>}
 */
function withPlaceRest(cards) {
    if (!offline) return cards;
    const clock = options?.getClock?.()?.actions ?? [];
    /** @param {string} id @param {string} label */
    const timed = (id, label) => {
        const action = clock.find(a => a.id === id);
        return action ? { id: `clock:${id}`, label, detail: action.why, enabled: action.enabled, cost: 0 } : null;
    };
    const inn = cards.find(card => card.id === 'posada');
    if (inn) {
        const idle = timed('slot', 'Pasar el rato');
        return idle ? cards.map(card => (card === inn ? { ...card, actions: [...card.actions, idle] } : card)) : cards;
    }
    // Fuera, acampar es la noche entera (la ficha de siempre: el fuego, las guardias, la cena).
    const camp = (options?.getChips?.(Infinity) ?? []).find(chip => chip.id === 'camp');
    // Donde no se puede acampar (un sitio con techo pero sin posada), el descanso largo, tal cual:
    // que la noche entera no se quede sin sitio donde pasarla.
    const acts = [
        timed('short', 'Descanso corto'),
        camp ? { id: 'chip:camp', label: camp.label, detail: 'El fuego, las guardias y la cena; luego se duerme la noche entera (descanso largo).', enabled: true, cost: 0 }
            : timed('long', 'Descanso largo'),
    ].filter(Boolean);
    return acts.length > 0 ? [...cards, { id: 'descanso', label: 'Descansar', icon: 'fa-campground', actions: acts }] : cards;
}

/**
 * Lo que hace un botón de un sitio: un servicio, o (J18.9) pasar el tiempo o una ficha.
 *
 * @param {string} id
 */
function runPlaceAction(id) {
    if (id.startsWith('clock:')) {
        options?.onClock?.(/** @type {'slot'|'day'|'short'|'long'} */ (id.slice('clock:'.length)));
        return;
    }
    if (id.startsWith('chip:')) {
        const chip = (options?.getChips?.(Infinity) ?? []).find(c => c.id === id.slice('chip:'.length));
        if (chip) options?.onChip?.(chip);
        return;
    }
    options?.onService?.(id);
}

/**
 * La fila de fichas al pie del pueblo o del tablero (J18.8): sin pestañas, lo que no tiene su
 * botón en esa pantalla tiene que poder hacerse desde ella.
 *
 * @param {HTMLElement} footer
 * @param {(chip: import('./action-chips.js').ActionChip) => boolean} skip Lo que esa pantalla ya enseña.
 */
function renderFooterChips(footer, skip) {
    const row = el('div', 'gs-chips gs-chips-foot');
    footer.appendChild(row);
    renderActionChips(row, { skip });
    if (row.classList.contains('gs-chips-empty')) row.remove();
}

/**
 * La marca de la última línea que se cuenta, para el director (J18.8): cambia cuando llega
 * algo nuevo que leer. Las notas pequeñas del motor (un golpe, la comida, el descanso) no
 * cuentan, ni lo que se dice en una charla, que ya se lee en su ventana.
 *
 * @returns {string}
 */
function storyMark() {
    const messages = document.querySelectorAll('#chat .mes:not([is_user="true"])');
    for (let i = messages.length - 1; i >= 0; i--) {
        const node = messages[i];
        if (node.getAttribute('is_system') === 'true' && node.classList.contains('smallSysMes')) continue;
        const body = node.querySelector('.mes_text');
        const said = (body?.textContent || '').trim();
        if (!body || !said || /^\S{0,3}\s*\[GENTE\]/u.test(said)) continue;
        // Lo que en la caja no se leería (solo la etiqueta y un «Hecho:») tampoco lleva a ella.
        if (!cleanNovelCopy(/** @type {Element} */ (body.cloneNode(true)))) continue;
        return `${node.getAttribute('mesid')}:${said.slice(0, 48)}`;
    }
    return '';
}

/**
 * J18.10: en el registro, las etiquetas del motor envueltas para que el Modo Juego las esconda
 * sin conexión. Solo lo último (lo de antes ya se miró) y solo lo que ha cambiado.
 */
function tagLog() {
    const bodies = [...document.querySelectorAll('#chat .mes .mes_text')].slice(-40);
    for (const body of bodies) {
        const size = String((body.textContent || '').length);
        if (/** @type {HTMLElement} */ (body).dataset.gsTags === size) continue;
        markEngineTags(body);
        /** @type {HTMLElement} */ (body).dataset.gsTags = size;
    }
}

/**
 * La Exploración, a pantalla entera (Gem director de UX, 2026-09-27): sin el tablero, que
 * aquí no pinta nada, y con lo que se puede hacer en tres columnas en vez de una lista
 * infinita. Arriba el sitio y a qué huele; debajo, lo de aquí mismo (por edificios), los
 * tableros en los que se puede entrar y a dónde se puede viajar.
 *
 * Se viaja a los vecinos. Lo que queda más lejos se ve —con lo que cuesta y por dónde se
 * pasa—, pero no se pulsa: de la posada no se salta a la otra punta del mapa.
 *
 * Un sitio cerrado tampoco se esconde. Esconderlo haría la campaña más pequeña de lo que
 * es y no dejaría nada a lo que apuntar; enseñarlo con su motivo convierte un «no» en una
 * meta.
 *
 * @param {HTMLElement} panel
 * @param {import('./exploration-scene.js').ExplorationView} view
 */
function renderExploration(panel, view) {
    const scroll = panel.scrollTop;
    panel.textContent = '';

    // J3.11: la pantalla del pueblo. Dentro de un sitio (la herrería, la posada), su escena y
    // nada más; fuera, el selector de sitios encima de los tableros y el viaje.
    const allCards = withPlaceRest(options?.getServices?.() ?? []);
    const townCtx = {
        here: view.here,
        hero: String(view.party?.[0]?.name ?? ''),
        slot: String(options?.getClock?.()?.slot ?? ''),
        cards: allCards,
        chips: options?.getChips?.() ?? [],
        data: options?.getTown?.() ?? null,
        onService: (/** @type {string} */ id) => runPlaceAction(id),
        onChip: (/** @type {any} */ chip) => options?.onChip?.(chip),
        refresh: () => refreshGameShell(),
    };
    const town = view.here ? buildTown(townCtx) : null;
    const inTown = Boolean(town && town.places.length > 0);
    if (town && inTown && renderTownScene(panel, town, townCtx)) {
        panel.scrollTop = scroll;
        return;
    }

    const here = el('header', 'gs-here ex-head');
    const title = el('div', 'ex-title');
    title.appendChild(el('i', 'fa-solid fa-location-dot'));
    title.appendChild(el('span', 'gs-here-name', view.here || 'En ninguna parte todavía'));
    here.appendChild(title);
    if (view.description) here.appendChild(el('div', 'gs-here-desc', view.description));
    if (view.fortune) here.appendChild(el('div', 'gs-here-fortune', view.fortune));
    panel.appendChild(here);
    if (town && inTown) panel.appendChild(renderTownSelector(town, townCtx));

    const dashboard = el('div', 'gs-explore-dashboard');

    // Aquí mismo: la posada, la herrería, el templo, el tablón. Cada edificio en su
    // tarjeta, con lo que cuesta dicho antes de pulsar. Con sitios en el pueblo, solo lo que
    // no es de ninguno.
    const local = exploreColumn('fa-building', 'Aquí mismo', 'here');
    const services = town && inTown ? allCards.filter(card => town.rest.includes(card.id)) : allCards;
    const night = /noche/i.test(String(options?.getClock?.()?.slot ?? ''));
    for (const card of services) {
        const box = el('div', 'gs-service');
        box.dataset.service = card.id;
        const head = el('div', 'gs-service-head');
        // El sitio en pixel detrás de su nombre (la posada, la forja…), de noche si es de noche.
        const place = firstArt('place', { id: card.id, night });
        if (place) {
            head.classList.add('gs-service-drawn');
            head.style.setProperty('--gs-service-art', cssUrl(place));
        }
        head.appendChild(el('i', `fa-solid ${card.icon}`));
        head.appendChild(el('span', '', card.label));
        // D-J29: la tienda o la herrería cerradas lo dicen en su cabecera («Cerrado: es de noche»).
        const shut = /** @type {any} */ (card).closed;
        if (shut?.sign) {
            box.classList.add('gs-service-closed');
            box.title = String(shut.line || shut.sign);
            head.appendChild(el('span', 'gs-service-closed-sign', String(shut.sign)));
        }
        box.appendChild(head);
        const list = el('div', 'gs-service-actions');
        for (const action of card.actions) {
            const button = makeButton('gs-service-btn gs-btn-action');
            button.dataset.action = action.id;
            // El precio va a la derecha; dicho también en la etiqueta, se leía dos veces.
            const priced = Number(action.cost) > 0;
            button.appendChild(el('span', 'gs-btn-label', priced ? action.label.replace(/\s*\(\d+ de oro\)\s*$/, '') : action.label));
            if (priced) button.appendChild(el('span', 'gs-btn-cost', `${action.cost} oro`));
            button.title = action.detail;
            button.disabled = !action.enabled;
            button.addEventListener('click', () => runPlaceAction(action.id));
            list.appendChild(button);
        }
        box.appendChild(list);
        local.appendChild(box);
    }
    if (services.length === 0) local.appendChild(el('div', 'ex-empty', 'Aquí no hay posada, ni tienda, ni nadie que venda nada.'));
    if (!inTown || services.length > 0) dashboard.appendChild(local);

    // Los tableros de aquí: entrar lleva la pantalla al tablero.
    const boards = exploreColumn('fa-chess-board', 'Tableros de aquí', 'boards');
    for (const board of view.boards) {
        const card = exploreCard('gs-board', board.icon || 'fa-chess-board', board.name, 'gs-board-name',
            [board.current ? 'Estáis dentro' : board.note, '']);
        card.classList.toggle('current', board.current);
        card.title = board.current ? `Volver a ${board.name}` : `Entrar en ${board.name}`;
        card.addEventListener('click', () => {
            if (!board.current) options?.onEnterBoard(board.name);
            setScene(SCENE.COMBAT);
        });
        boards.appendChild(card);
    }
    if (view.boards.length === 0) boards.appendChild(el('div', 'ex-empty', 'Aquí no hay ningún tablero.'));
    dashboard.appendChild(boards);

    // Viajar: dónde estáis, los vecinos, y lo que queda más lejos o cerrado.
    const travel = exploreColumn('fa-map', 'Viajar', 'travel');
    const order = { here: 0, near: 1, shut: 2, far: 3, none: 4 };
    const sorted = [...view.places].sort((a, b) => (order[a.reach] ?? 5) - (order[b.reach] ?? 5));
    let farTitle = false;
    for (const place of sorted) {
        const open = place.reach === 'near' && place.status !== 'locked';
        if (!open && !place.current && !farTitle) {
            travel.appendChild(el('div', 'ex-subtitle', 'Más lejos, o cerrado'));
            farTitle = true;
        }
        const icon = place.current ? 'fa-location-crosshairs'
            : place.status === 'locked' || place.reach === 'shut' || place.reach === 'none' ? 'fa-lock'
                : place.status === 'complete' ? 'fa-circle-check' : place.icon || 'fa-location-dot';
        const days = place.days === 1 ? '1 día de viaje' : `${place.days} días de viaje`;
        const note = place.current ? 'Estáis aquí'
            : place.reasons.length > 0 ? place.reasons.join(' ')
                : place.reach === 'far' ? `${days}, pasando por ${place.via}`
                    : place.reach === 'shut' || place.reach === 'none' ? place.why
                        : days;
        const card = exploreCard('gs-place', icon, place.name, 'gs-place-name', [note, place.pending ?? '']);
        card.classList.add(`status-${place.status}`, `reach-${place.reach}`);
        card.classList.toggle('current', place.current);
        card.disabled = !open || place.current;
        card.title = place.current ? 'Ya estáis aquí'
            : open ? `Viajar a ${place.name}` : (place.reasons.join(' ') || place.why || 'No se puede ir desde aquí');
        card.addEventListener('click', () => options?.onTravel(place.name));
        travel.appendChild(card);
    }
    dashboard.appendChild(travel);

    panel.appendChild(dashboard);
    panel.scrollTop = scroll;
}

// H10: acabado el cambio de chat, la pantalla se pone al día con el chat nuevo.
onChatSwitchEnd(() => { if (isShellOpen()) refreshGameShell(); });

/**
 * Redraw the shell's own chrome from the engine. The stage redraws itself: the panel on
 * it is the real one, so whatever the game renders there is already current.
 */
export function refreshGameShell() {
    if (!isShellOpen() || !root || !options) return;
    // J15.5: dónde está el foco antes de redibujar: los botones se hacen de nuevo cada vez, y el
    // que se acaba de pulsar con Intro desaparecía con el foco dentro.
    const kept = captureFocus(root);

    const engine = options.getSituation();
    // H10: a medio cambiar de chat (del gremio a una campaña, o de vuelta) no hay partida un
    // momento; la pantalla se queda como estaba en vez de enseñar la portada. Al acabar el
    // cambio se redibuja (`onChatSwitchEnd`, abajo).
    if (!engine?.hasChat && isChatSwitching() && root.dataset.scene && root.dataset.scene !== SCENE.TITLE) return;
    // J18.7 y J18.8: una partida sin conexión se juega sin caja de escribir y sin pestañas; lo
    // que se cuenta de nuevo lleva a la novela (`story`).
    offline = Boolean(engine?.hasChat && engine.offline);
    root.classList.toggle('gs-offline', offline);
    const told = offline ? { story: storyMark() } : {};
    if (offline) tagLog();
    // J3.11: los sitios del pueblo, que el juego no cuenta: con ellos se puede explorar aunque
    // el mundo tenga una sola localización (el gremio). En pelea no hacen falta.
    const situation = engine?.hasChat && !engine.combatActive && engine.locationName
        ? { ...engine, ...told, townPlaces: countTownPlaces(String(engine.locationName), options.getTown?.() ?? null, () => { if (isShellOpen()) refreshGameShell(); }) }
        : { ...engine, ...told };
    // The director decides from what *changed*, not only from what is. What it decides
    // becomes the standing pick, so the screen does not snap back on the next redraw.
    const choice = directScene(lastSituation, situation, manualScene);
    manualScene = choice.override;
    lastSituation = situation;

    // The director says where the *game* is; which screens exist is the shell's problem.
    // Leaving a board sends the game to the map, and until H4 builds that scene the
    // closest thing this can show is the conversation. Better than a screen whose only
    // content is the news that it does not exist yet.
    const scene = BUILT_SCENES.has(choice.scene) ? choice.scene : SCENE.DIALOGUE;
    // Sin partida abierta no hay nada que pausar ni a donde volver.
    if (scene === SCENE.TITLE && paused) setPaused(false);

    // The explanation changes when something happens or when the screen moves, and not
    // on every redraw in between.
    if (choice.event || scene !== root.dataset.scene) sceneReason = choice.reason;

    // Idea 155: la primera vez en cada escena, un consejo.
    if (scene !== root.dataset.scene && scene !== SCENE.TITLE) options.onScene?.(scene === SCENE.COMBAT ? 'combat' : scene === SCENE.EXPLORATION ? 'exploration' : 'dialogue');
    if (scene !== root.dataset.scene) options.onSceneTime?.(scene);
    root.dataset.scene = scene;
    root.dataset.source = choice.source;

    // La escena manda tambien en lo que suena. Pedir la misma pista dos veces no hace
    // nada, que es justo lo que hace falta aqui: esto se redibuja en cada turno.
    playForScene(options.audioSceneFor?.(scene) ?? scene);

    const bar = options.getCombatBar();
    const dialogue = options.getDialogue();
    const head = /** @type {HTMLElement} */ (root.querySelector('.gs-head-state'));
    head.textContent = scene === SCENE.TITLE ? 'Menu principal'
        : scene === SCENE.COMBAT
            ? (bar.active ? `Ronda ${bar.round}` : (situation.boardName || 'Sin tablero'))
            : dialogue.moment;
    head.title = sceneReason;
    head.classList.toggle('gs-head-round', scene === SCENE.COMBAT && Boolean(bar.active));

    renderDialogue(/** @type {HTMLElement} */ (root.querySelector('.gs-scene-dialogue')), dialogue);
    if (scene === SCENE.DIALOGUE) renderNovel(/** @type {HTMLElement} */ (root.querySelector('.gs-scene-dialogue')), dialogue, String(situation.locationName || ''));

    // El menu principal solo existe en el titulo; en cuanto hay partida, estorba.
    if (scene === SCENE.TITLE) {
        renderTitleMenu(/** @type {HTMLElement} */ (root.querySelector('.gs-menu')));
    } else {
        titleView = 'menu';
    }

    if (scene === SCENE.EXPLORATION) {
        renderExploration(/** @type {HTMLElement} */ (root.querySelector('.gs-places')), options.getExploration());
    }

    renderClock(/** @type {HTMLElement} */ (root.querySelector('.gs-clock')));
    renderFocus(/** @type {HTMLElement} */ (root.querySelector('.gs-focus')), /** @type {HTMLElement|null} */ (root.querySelector('.gs-tools')));
    // J18.8: sin conexión, en la novela, «Continuar» lleva a donde se esté al acabar de leer.
    // J18.9: y descansar no se ofrece mientras se lee: es cosa del sitio (la posada, acampar fuera).
    const next = offline && scene === SCENE.DIALOGUE ? continueScene(situation) : null;
    renderActionChips(/** @type {HTMLElement} */ (root.querySelector('.gs-vn-box > .gs-chips')), {
        next,
        situation,
        ...(next ? { skip: (/** @type {import('./action-chips.js').ActionChip} */ chip) => chip.id === 'camp' || chip.id === 'rest:corto' } : {}),
    });
    const log = root.querySelector('.gs-vn-log-btn');
    if (log instanceof HTMLElement) log.title = offline ? 'Todo lo dicho hasta ahora' : 'Todo lo dicho hasta ahora, y la caja para escribir';

    renderSwitcher(/** @type {HTMLElement} */ (root.querySelector('.gs-scenes')), situation, scene);
    const actions = /** @type {HTMLElement} */ (root.querySelector('.gs-actions'));
    // Tanda 10: fuera de la pelea, el pie deja de flotar.
    if (!(scene === SCENE.COMBAT && bar.active)) releaseCombatActionBar(actions);
    if (scene === SCENE.COMBAT && offline && !bar.active) {
        // J18.8: en el tablero sin pelea, lo que se puede hacer, al pie. Salir tiene su botón en
        // el propio tablero; la pelea empieza sola (tanda 10, `party/fight-entry.js`).
        actions.textContent = '';
        renderFooterChips(actions, chip => chip.id === 'leave');
        if (actions.childElementCount === 0) renderActionBar(actions, bar);
    } else if (scene === SCENE.COMBAT) {
        renderActionBar(actions, bar);
    } else if (scene === SCENE.EXPLORATION) {
        // De viaje, lo que hace falta abajo es saber como llega el grupo.
        actions.textContent = '';
        // J18.8: y sin conexión, lo que se puede hacer aquí, menos lo que ya está en pantalla:
        // entrar en un tablero y viajar, que tienen sus tarjetas; y descansar, que es cosa del
        // sitio (J18.9): la posada, o la tarjeta «Descansar» donde no la hay.
        if (offline) renderFooterChips(actions, chip => /^(enter|go):/.test(chip.id) || chip.id === 'camp' || chip.id === 'rest:corto');
        const strip = el('div', 'gs-party-strip');
        actions.appendChild(strip);
        renderChips(strip, options.getExploration().party);
    } else {
        // In a conversation the chat below is the way in; a row of combat buttons under
        // it would only be a row of disabled buttons.
        actions.textContent = '';
    }
    // J15.5: redibujado todo, el foco al mismo botón (o a lo principal, si ese ya no está); y
    // los botones que son solo un icono, con su nombre para el lector de pantalla.
    restoreFocus(root, kept);
    nameIconButtons(root);
}

/**
 * Switch scene by hand. The pick is remembered only while the director agrees it has
 * something to show.
 *
 * @param {SceneName} scene
 */
export function setScene(scene) {
    if (!isShellOpen() || !options) return;
    manualScene = scene;
    refreshGameShell();
}

/**
 * Keys only act when the player is not typing: the chat form lives inside the dialogue
 * scene, and every key pressed in it belongs to the message being written.
 *
 * With one exception. Escape leaves the box first, because otherwise clicking into the
 * chat is a one-way door: no key gets you out of the game any more, and the only way back
 * is the mouse. Pressing it twice — once to leave the box, once to leave the game — is
 * what a text editor does, and what the walk now checks.
 *
 * @param {KeyboardEvent} event
 */
function handleKey(event) {
    const target = /** @type {HTMLElement|null} */ (event.target);
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        if (event.key === 'Escape') target?.blur();
        return;
    }

    if (event.key === 'Escape') {
        // J15.5: Esc cierra primero lo de delante. Una ventana (`<dialog>`) se cierra sola con su
        // Esc: si aquí se paraba la tecla, la ventana se quedaba abierta y la pausa salía detrás.
        if (event.defaultPrevented || topDialog()) return;
        event.preventDefault();
        // Los dados, la tarjeta de un enemigo, una lista de la barra de combate, la chuleta.
        if (closeTopOverlay()) return;
        setPaused(!paused);
        return;
    }

    // Con el menu de pausa delante, las teclas de escena son suyas, no de la partida.
    if (paused) return;

    // J18.8: sin conexión, 1, 2 y 3 no saltan de escena: se pasa haciendo algo.
    const scene = offline ? null : sceneForShortcut(event.key);
    if (scene) {
        event.preventDefault();
        setScene(scene);
        return;
    }

    // Idea 152: el resto de atajos. Con una ventana abierta delante, las teclas son suyas.
    if (document.querySelector('dialog[open]')) return;
    const action = actionForKey(event);
    if (!action) return;
    event.preventDefault();
    if (action === 'journal') options?.onJournal?.();
    else if (action === 'glance') options?.onGlance?.();
    else if (action === 'help') options?.onHelp?.();
    else if (action === 'tray') options?.onTray?.();
    else if (action === 'dice') options?.onDice?.();
    else if (action === 'glossary') options?.onGlossary?.();
    else if (action === 'keys') toggleKeySheet();
}

/** Idea 152: la chuleta de atajos, encima de todo; se quita con la misma tecla o pulsandola. */
function toggleKeySheet() {
    const open = document.querySelector('.gs-keys');
    if (open) {
        open.remove();
        return;
    }
    // J15.5: la chuleta es una ventana pequeña: se lee, y se cierra con «?», con Esc o pulsándola.
    const sheet = el('div', 'gs-keys');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Atajos de teclado');
    sheet.tabIndex = -1;
    sheet.appendChild(el('div', 'gs-keys-title', 'Atajos de teclado'));
    // Sin conexión no hay teclas de escena (J18.8): la chuleta no las promete.
    for (const shortcut of SHORTCUTS.filter(s => !(offline && s.action.startsWith('scene:')))) {
        const row = el('div', 'gs-keys-row');
        row.appendChild(el('kbd', '', shortcut.key));
        row.appendChild(el('span', '', shortcut.label));
        sheet.appendChild(row);
    }
    sheet.addEventListener('click', () => sheet.remove());
    document.body.appendChild(sheet);
    sheet.focus({ preventScroll: true });
}

/**
 * Dónde acaba la cabecera, en `--gs-head-bottom`: los avisos flotantes caen debajo (ver
 * game-shell.css). Con un alto fijo (96 px) se colaban encima de la segunda fila cuando la
 * misión o el reloj la hacían más alta, y el aviso se comía el clic de la Mesa o del Diario.
 * En el título la cabecera no se ve: mide cero y los avisos van arriba del todo.
 *
 * @param {HTMLElement} head
 */
function watchHeadHeight(head) {
    const measure = () => {
        const bottom = Math.max(0, Math.ceil(head.getBoundingClientRect().bottom));
        document.body.style.setProperty('--gs-head-bottom', `${bottom}px`);
    };
    measure();
    headWatcher?.disconnect();
    headWatcher = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    headWatcher?.observe(head);
}

/**
 * Open the shell.
 *
 * @param {ShellOptions} shellOptions
 */
export function openGameShell(shellOptions) {
    if (isShellOpen()) {
        refreshGameShell();
        return;
    }

    options = shellOptions;
    manualScene = null;
    lastSituation = null;
    sceneReason = '';
    titleView = 'menu';
    closeTownPlace();

    root = el('div', 'gs-root');
    root.id = 'game-shell';

    const head = el('header', 'gs-head');
    head.appendChild(el('div', 'gs-head-state'));
    head.appendChild(el('div', 'gs-focus'));
    // El reloj y los botones van juntos en una barra. En pantalla grande no es una caja
    // (`display: contents`) y se colocan como siempre; en el móvil es una fila que se desliza
    // (J20.1).
    const bar = el('div', 'gs-head-bar');
    bar.appendChild(el('div', 'gs-clock'));
    // Diario, Mesa, Mapa, Grupo, avisos, dados y «¿Qué hago?»: abajo a la derecha, junto al
    // reloj, y no en la línea de la misión, que es para leerla (Daniel, 2026-09-27).
    bar.appendChild(el('div', 'gs-tools'));
    head.appendChild(bar);
    head.appendChild(el('nav', 'gs-scenes'));
    // J20.4: la pausa, con su botón, para quien juega sin teclado. Con ratón no se ve (Esc).
    const pause = makeButton('gs-pause-open');
    pause.title = 'Pausa (Esc)';
    pause.setAttribute('aria-label', 'Pausa');
    pause.appendChild(el('i', 'fa-solid fa-bars'));
    pause.addEventListener('click', () => setPaused(!paused));
    head.appendChild(pause);
    const close = makeButton('gs-close');
    close.title = 'Salir del Modo Juego (Esc)';
    close.setAttribute('aria-label', 'Salir del Modo Juego');
    close.appendChild(el('i', 'fa-solid fa-xmark'));
    close.addEventListener('click', () => closeGameShell());
    head.appendChild(close);

    const stage = el('main', 'gs-stage');

    // One section per scene, both built at open. Switching scene shows one and hides the
    // other; it does not move anything, because every move of the chat is a chance to
    // lose its scroll or its focus.
    // El tablero y el mapa son el mismo panel: lo que cambia es si hay un tablero
    // abierto, y de eso ya se encarga el propio panel. Asi que la escena de combate y la
    // de exploracion comparten seccion, y lo que cambia es lo que las rodea.
    const map = el('section', 'gs-scene gs-scene-map');
    map.appendChild(el('div', 'gs-map-slot'));
    map.appendChild(el('aside', 'gs-places'));

    const dialogue = el('section', 'gs-scene gs-scene-dialogue');
    // La pantalla de titulo no se construye: ya existe. La bienvenida con las tarjetas de
    // campana se dibuja dentro de `#chat`, que viaja con `#sheld`, asi que basta con
    // ensenar la misma seccion con otro rotulo y sin el ruido de una conversacion.
    dialogue.appendChild(el('div', 'gs-title', 'DnD Coin'));
    dialogue.appendChild(el('div', 'gs-menu'));
    // J18.3: la historia como una novela visual. Quien habla, grande; el texto, en una caja
    // ancha abajo, con su nombre en una placa y las fichas dentro. Fuera de la escena de
    // diálogo la caja no existe para el diseño (`display: contents`): las fichas siguen
    // donde estaban en las otras escenas.
    // Detrás de todo, el escenario del sitio en pixel, apagado (solo en la novela).
    const backdrop = el('div', 'gs-vn-backdrop');
    backdrop.hidden = true;
    dialogue.appendChild(backdrop);
    dialogue.appendChild(el('div', 'gs-vn-portrait'));
    dialogue.appendChild(el('div', 'gs-speaker'));
    dialogue.appendChild(el('div', 'gs-chat-slot'));
    const box = el('div', 'gs-vn-box');
    box.appendChild(el('div', 'gs-vn-nameplate'));
    box.appendChild(el('div', 'gs-vn-text'));
    box.appendChild(el('div', 'gs-chips'));
    box.appendChild(buildNovelControls());
    dialogue.appendChild(box);
    dialogue.appendChild(el('div', 'gs-party-strip'));
    stage.appendChild(map);
    stage.appendChild(dialogue);

    root.appendChild(head);
    root.appendChild(stage);
    root.appendChild(el('footer', 'gs-actions'));
    document.body.appendChild(root);
    document.body.classList.add('game-shell-on');
    watchHeadHeight(head);

    adopt(BOARD_SELECTOR, /** @type {HTMLElement} */ (map.querySelector('.gs-map-slot')));
    adopt(CHAT_SELECTOR, /** @type {HTMLElement} */ (dialogue.querySelector('.gs-chat-slot')));
    options.renderStage();
    scrollChatDown();

    // J18.8: sin conexión, una línea nueva en el chat es algo que leer, y la pantalla se entera
    // aunque quien la cuenta no avise al Modo Juego. Una vez por tanda de mensajes.
    const chatList = document.querySelector('#chat');
    if (chatList && typeof MutationObserver === 'function') {
        chatWatcher = new MutationObserver(() => {
            if (!offline || chatRedraw) return;
            chatRedraw = setTimeout(() => {
                chatRedraw = null;
                if (isShellOpen()) refreshGameShell();
            }, 60);
        });
        chatWatcher.observe(chatList, { childList: true });
    }

    keyHandler = handleKey;
    document.addEventListener('keydown', keyHandler);
    // J15.5: el teclado del juego (flechas en las listas, Tab en círculo en las ventanas, el foco
    // que vuelve) y las animaciones según el aparato y «reducir movimiento».
    keyboardOff?.();
    keyboardOff = installKeyboard(document);
    applyMotion();
    motionOff?.();
    motionOff = watchMotion();

    refreshGameShell();
    // El arte en pixel: el índice se lee una vez y, al llegar, se redibuja con él.
    void loadPixelManifest().then(() => { if (isShellOpen()) refreshGameShell(); });
}

/**
 * Close the shell and leave the page as it was found: the board panel back in the party
 * drawer, the body class gone, the key handler unbound.
 */
export function closeGameShell() {
    if (!isShellOpen()) return;
    options?.onSceneTime?.('out');

    setPaused(false);
    stopSceneAudio();
    chatWatcher?.disconnect();
    chatWatcher = null;
    if (chatRedraw) clearTimeout(chatRedraw);
    chatRedraw = null;
    offline = false;
    releaseAll();

    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
    keyboardOff?.();
    keyboardOff = null;
    motionOff?.();
    motionOff = null;

    root?.remove();
    root = null;
    // Back under the top bar, where its own stylesheet puts it.
    scrollChatDown();
    manualScene = null;
    lastSituation = null;
    sceneReason = '';
    closeTownPlace();
    document.body.classList.remove('game-shell-on');
    headWatcher?.disconnect();
    headWatcher = null;
    document.body.style.removeProperty('--gs-head-bottom');

    const redraw = options?.renderStage;
    options?.onClose?.();
    options = null;
    // Redraw last: the panel is home again, and the game draws it there the usual way.
    redraw?.();
}

/**
 * Open it if it is closed, close it if it is open.
 *
 * @param {ShellOptions} shellOptions
 * @returns {boolean} Whether the shell is open afterwards.
 */
export function toggleGameShell(shellOptions) {
    if (isShellOpen()) {
        closeGameShell();
        return false;
    }
    openGameShell(shellOptions);
    return true;
}
