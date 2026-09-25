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
 * See wiki/PROPUESTA_FRONTEND_MODO_JUEGO.md, H1 · wiki/ROADMAP.md, Fase H.
 */

import {
    SCENE, SWITCHABLE_SCENES, SCENE_INFO,
    directScene, isSceneAvailable, describeScene, sceneForShortcut, labelFor,
} from './scene-director.js';
import { playForScene, stopSceneAudio } from './scene-audio.js';
import { SHORTCUTS, actionForKey } from './shortcuts.js';

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
 * @property {() => void} onEndTurn
 * @property {() => void} onFlee
 * @property {() => void} onObjectives
 * @property {() => import('./clock-widget.js').ClockView} [getClock] El dia y lo que deja hacer.
 * @property {(action: 'slot'|'day'|'short'|'long') => void} [onClock] Pasar el tiempo o descansar.
 * @property {() => import('./action-chips.js').ActionChip[]} [getChips] Lo que se puede hacer sin escribirlo.
 * @property {(chip: import('./action-chips.js').ActionChip) => void} [onChip]
 * @property {(memberId: string) => void} [onCompanion] Abrir la ficha de un companero.
 * @property {() => void} [onNewCampaign] Empezar una partida desde el menu principal.
 * @property {() => number} [countCampaigns] Cuantas partidas hay para cargar.
 * @property {() => number} [countHall] Cuantos caidos hay en el salon de la fama (idea 199).
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
 * @property {() => Array<{id: string, label: string, icon: string, actions: Array<{id: string, label: string, detail: string, enabled: boolean}>}>} [getServices]
 *   Los servicios de aqui, con lo que se puede hacer en cada uno.
 * @property {(actionId: string) => void} [onService]
 * @property {() => {title: string, hint: string, act: number}|null} [getFocus]
 *   Lo que se tiene entre manos: el hito abierto del hilo.
 * @property {() => void} [onJournal] Abrir el diario (idea 100).
 * @property {() => void} [onGlance] El grupo de un vistazo (idea 162).
 * @property {() => number} [getNoticeCount] Avisos sin ver (idea 159).
 * @property {() => void} [onTray] Abrir la bandeja de avisos.
 * @property {() => void} [onAutoTurn] Que el compañero de turno actue solo (idea 18).
 * @property {() => void} [onDice] El historial de dados (idea 168).
 * @property {(mode: string) => void} [onRetry] Rehacer la ultima respuesta (idea 150).
 * @property {() => void} [onGlossary] El glosario (idea 156).
 * @property {(scene: string) => void} [onScene] Al cambiar de escena: el consejo de la primera vez (idea 155).
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
/**
 * Que ensena la pantalla de titulo: el menu, o la lista de partidas guardadas.
 *
 * Empezar en la lista — como hacia antes — es empezar en medio: lo primero que ve alguien
 * que abre el juego deberia ser que puede empezar una, seguir una o cambiar las opciones.
 * @type {'menu'|'load'}
 */
let titleView = 'menu';

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

    if (titleView === 'load') {
        const back = makeButton('gs-menu-back');
        back.appendChild(el('i', 'fa-solid fa-arrow-left'));
        back.appendChild(el('span', '', ' Volver al menu'));
        back.addEventListener('click', () => {
            titleView = 'menu';
            refreshGameShell();
        });
        menu.appendChild(back);
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

    const saved = options?.countCampaigns?.() ?? 0;

    item('Partida nueva', 'fa-wand-sparkles', 'Una plantilla, un mundo generado o un libro',
        () => options?.onNewCampaign?.());
    item('Cargar partida', 'fa-folder-open',
        saved === 1 ? '1 campana guardada' : `${saved} campanas guardadas`,
        () => {
            titleView = 'load';
            refreshGameShell();
        });
    // La biblioteca no necesita partida abierta: es tuya, no de una campana.
    if (options?.onCompendium) {
        item('Compendio', 'fa-book-open', 'Tu biblioteca: armas, bichos, gente, nombres',
            () => options?.onCompendium?.());
    }
    // Idea 199: los caidos de todas las partidas. Solo si ya ha caido alguien.
    const fallen = options?.countHall?.() ?? 0;
    if (fallen > 0 && options?.onHall) {
        item('Salón de la fama', 'fa-monument', fallen === 1 ? '1 caído' : `${fallen} caídos`,
            () => options?.onHall?.());
    }
    item('Opciones', 'fa-sliders', 'Los ajustes de SillyTavern, donde siempre',
        () => options?.onOptions());

    const leave = makeButton('gs-menu-leave');
    leave.textContent = 'Salir al SillyTavern de siempre';
    leave.addEventListener('click', () => closeGameShell());
    menu.appendChild(leave);
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
    list.appendChild(el('div', 'gs-targets-title', 'Lo que sabes hacer'));

    for (const ability of abilities) {
        const row = makeButton('gs-target');
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
            list.appendChild(el('div', 'gs-targets-title', `${ability.label} \u2014 \u00bfsobre quien?`));
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
    list.appendChild(el('div', 'gs-targets-title', 'En vez de pegar'));

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
            list.appendChild(el('div', 'gs-targets-title', `${maneuver.label} — ¿a quien?`));
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
}

/**
 * Draw the row of things that can be done without typing them.
 *
 * Cada ficha sale del estado, asi que ninguna ofrece algo que luego no pase. La que abre
 * una puerta gasta — puede despertar una sala —, y por eso es un boton; la de hablar solo
 * deja el texto empezado en el chat, porque lo que se diga lo decide quien juega.
 *
 * @param {HTMLElement} row
 */
function renderActionChips(row) {
    if (!options?.getChips) {
        row.textContent = '';
        return;
    }

    const chips = options.getChips();
    const checks = options?.getChecks?.() ?? [];
    row.textContent = '';
    row.classList.toggle('gs-chips-empty', chips.length === 0 && checks.length === 0);

    for (const chip of chips) {
        const button = makeButton(`gs-chip-action gs-chip-${chip.source}`);
        button.title = chip.command
            ? `Ejecuta ${chip.command}`
            : (chip.draft ? 'Deja la frase empezada en el chat' : chip.label);
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
    list.appendChild(el('div', 'gs-targets-title', 'Intentarlo: el dado decide, no la prosa'));
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
 */
function renderFocus(slot) {
    if (!slot) return;
    slot.textContent = '';
    const focus = options?.getFocus?.() ?? null;
    const guide = Boolean(options?.onJournal || options?.onHelp || options?.getMeter?.());
    slot.classList.toggle('gs-focus-empty', !focus && !guide);
    if (focus) {
        slot.appendChild(el('i', 'fa-solid fa-compass'));
        slot.appendChild(el('span', 'gs-focus-title', focus.title));
        if (focus.hint) slot.appendChild(el('span', 'gs-focus-hint', focus.hint));
        slot.title = `Acto ${focus.act}`;
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
        tray.addEventListener('click', () => options?.onTray?.());
        buttons.appendChild(tray);
    }
    if (options?.onDice) {
        const dice = makeButton('gs-guide-btn gs-dice');
        dice.appendChild(el('i', 'fa-solid fa-dice-d20'));
        dice.title = 'El historial de dados: ¿el dado me odia?';
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
    if (buttons.childElementCount > 0) slot.appendChild(buttons);
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
    clock.appendChild(el('span', 'gs-clock-label', view.label));

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

    const endTurn = makeButton('gs-btn');
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
    list.appendChild(el('div', 'gs-targets-title', 'A tu alcance'));
    for (const target of bar.targets) {
        const row = makeButton('gs-target');
        row.appendChild(el('span', 'gs-target-name', target.name));
        row.appendChild(el('span', 'gs-target-detail', target.detail));
        row.addEventListener('click', () => {
            list.remove();
            options?.onAttack(target.name);
        });
        list.appendChild(row);
    }
    footer.appendChild(list);
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
        who.appendChild(el('div', 'gs-speaker-name', view.speaker.name));
        if (view.speaker.rankLabel) {
            who.appendChild(el('div', 'gs-speaker-rank', view.speaker.rankLabel));
        }
        speaker.appendChild(who);
        // Idea 150: rehacer la ultima respuesta, igual, mas corta o con mas nervio.
        if (options?.onRetry) {
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

        if (chip.avatar) {
            const image = document.createElement('img');
            image.className = 'gs-chip-avatar';
            image.src = chip.avatar;
            image.alt = chip.name;
            card.appendChild(image);
        }

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
        existing?.remove();
        return;
    }
    if (existing) return;

    const overlay = el('div', 'gs-pause');
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
    item('Opciones', 'fa-sliders', () => options?.onOptions());
    item('Reglas del juego', 'fa-scale-balanced', () => options?.onRules());
    if (options.onEditCampaign) {
        item('Editar la campana', 'fa-map-location-dot', () => {
            setPaused(false);
            options?.onEditCampaign?.();
        });
    }
    if (options.onExport) {
        item('Exportar campana', 'fa-file-export', () => {
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
}

/**
 * Draw the travel panel beside the map: where you are, what boards this place holds, and
 * everywhere else, with the shut ones explaining themselves.
 *
 * A locked place is not hidden. Hiding it would make the campaign look smaller than it
 * is and give the player nothing to aim at; showing it with its reason turns a refusal
 * into a goal.
 *
 * @param {HTMLElement} panel
 * @param {import('./exploration-scene.js').ExplorationView} view
 */
function renderExploration(panel, view) {
    panel.textContent = '';

    const here = el('div', 'gs-here');
    here.appendChild(el('div', 'gs-here-name', view.here || 'En ninguna parte todavia'));
    if (view.description) here.appendChild(el('div', 'gs-here-desc', view.description));
    if (view.fortune) here.appendChild(el('div', 'gs-here-fortune', view.fortune));
    panel.appendChild(here);

    // Lo que hay aqui: la posada, la herreria, el templo, el tablon. Cada tarjeta con lo que
    // se puede hacer, y lo que cuesta dicho antes de pulsar.
    const services = options?.getServices?.() ?? [];
    if (services.length > 0) {
        panel.appendChild(el('div', 'gs-places-title', 'Aquí'));
        const grid = el('div', 'gs-services');
        for (const card of services) {
            const box = el('div', 'gs-service');
            box.dataset.service = card.id;
            const head = el('div', 'gs-service-head');
            head.appendChild(el('i', `fa-solid ${card.icon}`));
            head.appendChild(el('span', '', card.label));
            box.appendChild(head);
            for (const action of card.actions) {
                const button = makeButton('gs-service-btn');
                button.dataset.action = action.id;
                button.textContent = action.label;
                button.title = action.detail;
                button.disabled = !action.enabled;
                button.addEventListener('click', () => options?.onService?.(action.id));
                box.appendChild(button);
            }
            grid.appendChild(box);
        }
        panel.appendChild(grid);
    }

    if (view.boards.length > 0) {
        panel.appendChild(el('div', 'gs-places-title', 'Tableros de aqui'));
        const list = el('div', 'gs-board-list');
        for (const board of view.boards) {
            const row = makeButton('gs-board');
            row.classList.toggle('current', board.current);
            row.appendChild(el('i', 'fa-solid fa-chess-board'));
            row.appendChild(el('span', 'gs-board-name', board.name));
            row.addEventListener('click', () => options?.onEnterBoard(board.name));
            list.appendChild(row);
        }
        panel.appendChild(list);
    }

    panel.appendChild(el('div', 'gs-places-title', 'El mapa de campana'));
    const places = el('div', 'gs-place-list');
    for (const place of view.places) {
        const row = makeButton('gs-place');
        row.classList.add(`status-${place.status}`);
        row.classList.toggle('current', place.current);

        const icon = place.status === 'complete' ? 'fa-circle-check'
            : place.status === 'locked' ? 'fa-lock' : 'fa-location-dot';
        row.appendChild(el('i', `gs-place-icon fa-solid ${icon}`));

        const body = el('div', 'gs-place-body');
        body.appendChild(el('div', 'gs-place-name', place.name));
        const note = place.reasons.length > 0
            ? place.reasons.join(' ')
            : place.boards === 1 ? '1 tablero' : `${place.boards} tableros`;
        body.appendChild(el('div', 'gs-place-note', note));
        if (place.pending) body.appendChild(el('div', 'gs-place-pending', place.pending));
        row.appendChild(body);

        row.disabled = place.status === 'locked' || place.current;
        row.title = place.reasons.join(' ') || (place.current ? 'Ya estas aqui' : `Viajar a ${place.name}`);
        row.addEventListener('click', () => options?.onTravel(place.name));
        places.appendChild(row);
    }
    panel.appendChild(places);
}

/**
 * Redraw the shell's own chrome from the engine. The stage redraws itself: the panel on
 * it is the real one, so whatever the game renders there is already current.
 */
export function refreshGameShell() {
    if (!isShellOpen() || !root || !options) return;

    const situation = options.getSituation();
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
    root.dataset.scene = scene;
    root.dataset.source = choice.source;

    // La escena manda tambien en lo que suena. Pedir la misma pista dos veces no hace
    // nada, que es justo lo que hace falta aqui: esto se redibuja en cada turno.
    playForScene(scene);

    const bar = options.getCombatBar();
    const dialogue = options.getDialogue();
    const head = /** @type {HTMLElement} */ (root.querySelector('.gs-head-state'));
    head.textContent = scene === SCENE.TITLE ? 'Menu principal'
        : scene === SCENE.COMBAT
            ? (bar.active ? `Ronda ${bar.round}` : (situation.boardName || 'Sin tablero'))
            : dialogue.moment;
    head.title = sceneReason;

    renderDialogue(/** @type {HTMLElement} */ (root.querySelector('.gs-scene-dialogue')), dialogue);

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
    renderFocus(/** @type {HTMLElement} */ (root.querySelector('.gs-focus')));
    renderActionChips(/** @type {HTMLElement} */ (root.querySelector('.gs-chips')));

    renderSwitcher(/** @type {HTMLElement} */ (root.querySelector('.gs-scenes')), situation, scene);
    const actions = /** @type {HTMLElement} */ (root.querySelector('.gs-actions'));
    if (scene === SCENE.COMBAT) {
        renderActionBar(actions, bar);
    } else if (scene === SCENE.EXPLORATION) {
        // De viaje, lo que hace falta abajo es saber como llega el grupo.
        actions.textContent = '';
        const strip = el('div', 'gs-party-strip');
        actions.appendChild(strip);
        renderChips(strip, options.getExploration().party);
    } else {
        // In a conversation the chat below is the way in; a row of combat buttons under
        // it would only be a row of disabled buttons.
        actions.textContent = '';
    }
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
        event.preventDefault();
        setPaused(!paused);
        return;
    }

    // Con el menu de pausa delante, las teclas de escena son suyas, no de la partida.
    if (paused) return;

    const scene = sceneForShortcut(event.key);
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
    const sheet = el('div', 'gs-keys');
    sheet.appendChild(el('div', 'gs-keys-title', 'Atajos de teclado'));
    for (const shortcut of SHORTCUTS) {
        const row = el('div', 'gs-keys-row');
        row.appendChild(el('kbd', '', shortcut.key));
        row.appendChild(el('span', '', shortcut.label));
        sheet.appendChild(row);
    }
    sheet.addEventListener('click', () => sheet.remove());
    document.body.appendChild(sheet);
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

    root = el('div', 'gs-root');
    root.id = 'game-shell';

    const head = el('header', 'gs-head');
    head.appendChild(el('div', 'gs-head-state'));
    head.appendChild(el('div', 'gs-focus'));
    head.appendChild(el('div', 'gs-clock'));
    head.appendChild(el('nav', 'gs-scenes'));
    const close = makeButton('gs-close');
    close.title = 'Salir del Modo Juego (Esc)';
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
    dialogue.appendChild(el('div', 'gs-title', 'SillyTavern RPG'));
    dialogue.appendChild(el('div', 'gs-menu'));
    dialogue.appendChild(el('div', 'gs-speaker'));
    dialogue.appendChild(el('div', 'gs-chat-slot'));
    dialogue.appendChild(el('div', 'gs-chips'));
    dialogue.appendChild(el('div', 'gs-party-strip'));
    stage.appendChild(map);
    stage.appendChild(dialogue);

    root.appendChild(head);
    root.appendChild(stage);
    root.appendChild(el('footer', 'gs-actions'));
    document.body.appendChild(root);
    document.body.classList.add('game-shell-on');

    adopt(BOARD_SELECTOR, /** @type {HTMLElement} */ (map.querySelector('.gs-map-slot')));
    adopt(CHAT_SELECTOR, /** @type {HTMLElement} */ (dialogue.querySelector('.gs-chat-slot')));
    options.renderStage();
    scrollChatDown();

    keyHandler = handleKey;
    document.addEventListener('keydown', keyHandler);

    refreshGameShell();
}

/**
 * Close the shell and leave the page as it was found: the board panel back in the party
 * drawer, the body class gone, the key handler unbound.
 */
export function closeGameShell() {
    if (!isShellOpen()) return;

    setPaused(false);
    stopSceneAudio();
    releaseAll();

    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }

    root?.remove();
    root = null;
    // Back under the top bar, where its own stylesheet puts it.
    scrollChatDown();
    manualScene = null;
    lastSituation = null;
    sceneReason = '';
    document.body.classList.remove('game-shell-on');

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
