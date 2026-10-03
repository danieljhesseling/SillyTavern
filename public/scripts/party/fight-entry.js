/**
 * Entrar en la pelea (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md): ya no hace falta pulsar
 * «Iniciar combate».
 *
 * Al entrar en un tablero con enemigos que os ven (los que el tablero dibuja a la vista: ni los
 * de una sala cerrada ni los que tapa la niebla), la pelea empieza sola:
 *
 * 1. **La decisión.** Si la pelea escrita tiene otras salidas (J12.2: hablar, pagar, huir,
 *    esconderse), primero se elige, en la ventana de novela visual de siempre, con «Pelear»
 *    delante. Ya no hay «Todavía no»: os han visto.
 * 2. **Colocarse.** Antes de la iniciativa, el grupo se pone en las casillas de salida: el juego
 *    ya los deja en un sitio que vale; se cambia pulsando a uno y luego una casilla azul (o
 *    arrastrándolo), y «Empezar» tira la iniciativa. A los compañeros que lleva el juego los
 *    coloca el juego. Si os pillaron huyendo o escondidos, no hay tiempo: empiezan ellos.
 * 3. **Emboscada.** Una sala que despierta al abrir su puerta no pregunta: directo a colocarse,
 *    alrededor de donde estáis.
 *
 * El tablero pregunta aquí qué encender y qué hace un clic mientras se coloca
 * (`placementHighlight`, `placementCellClick`, `placementTokenClick`); la barra es
 * `ui/combat-vtt/placement-bar.js`.
 */

import { getCurrentWorldEnemies } from '../world-info.js';
import { tokenArt } from '../world-map-renderer.js';
import { avoidFor } from '../game-engine/combat/avoid-fight.js';
import { fightWait } from '../game-engine/combat/party-fallen.js';
import { fightOpening, startCells, defaultPlacement, placeMember, placementHint } from '../game-engine/combat/placement.js';
import { mountPlacementBar } from '../game-engine/ui/combat-vtt/placement-bar.js';
import { isPlainFace } from '../game-engine/ui/pixel-art.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { isChatSwitching } from '../game-engine/ui/shell/chat-switch.js';
import { parseCellKey } from '../game-engine/board/terrain.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatBoardSelection } from './state.js';
import { getActiveBoardContext, isBoardWon, knownTrapsHere } from './board.js';
import { lastWaiting, renderLocationMapsPreview } from './board-view.js';
import { startWaitingFight } from './combat-flow.js';
import { openAvoidChoice, foesOf } from './avoid.js';
import { controlOf } from './spell-turn.js';
import { savePartyState } from './roster.js';
import { postCombatNarration } from './narration.js';
import { scenesPending } from './plot.js';

/**
 * @typedef {Object} PendingFight La pelea que está a punto de empezar: el grupo se coloca.
 * @property {string} board
 * @property {string} location
 * @property {Array<{name: string, x: number, y: number}>} placements Los que esperan.
 * @property {boolean} ambush
 * @property {Array<{x: number, y: number}>} cells Las casillas de salida.
 * @property {Record<string, {x: number, y: number}>} placement Dónde va cada uno.
 * @property {string} selected El elegido para colocar.
 * @property {string} said Lo que se cuenta al empezar.
 * @property {{update: (view: any) => void, destroy: () => void}|null} bar
 * @property {(() => void)|null} start J12.7: lo que empieza la pelea al pulsar «Empezar», si no
 *   es la de los que esperan en el tablero (una pelea de taberna o un duelo, con sus rivales hechos).
 * @property {string[]|null} only J12.7: los únicos que se colocan (en un duelo, quien pelea: los
 *   demás miran desde la pared).
 * @property {string} title Lo que dice la barra arriba, si no es lo de siempre.
 * @property {string} hint Lo que dice la barra debajo, si no es lo de siempre.
 * @property {(() => void)|null} onDrop Si se olvida sin empezar (se va del tablero).
 */

/** @type {PendingFight|null} */
let pending = null;

/** Si la decisión de novela visual está abierta. */
let deciding = false;

/** Si ya hay una mirada pendiente para esta vuelta del dibujo. */
let scheduled = false;

/** Para las pruebas: cuántas veces se ha abierto la pelea sola. */
let opened = 0;

/**
 * Si se ha esperado a que alguien entre en el grupo (la partida recién creada): entonces se da
 * un respiro antes de abrir la pelea, para que salga antes la escena que la empieza.
 */
let waitedForParty = false;

/**
 * Directo a la decisión (Daniel, 2026-10-03): el tablero donde la pelea ya se ha abierto (o ya ha
 * habido pelea) en esta visita. Tras huir, la novela se queda delante para leer cómo acabó.
 *
 * @type {{board: string, location: string}|null}
 */
let seenHere = null;

/** Apuntar que la pelea del tablero abierto ya se ha abierto en esta visita. */
function noteSeenHere() {
    if (currentBoardName) seenHere = { board: currentBoardName, location: currentLocationName };
}

/**
 * Directo a la decisión (Daniel, 2026-10-03): si en el tablero abierto espera una pelea que empieza
 * sola en cuanto se ve el tablero (os han visto y aún no se ha abierto en esta visita), o se está
 * decidiendo o colocando. Entonces el Modo Juego no se queda en la novela sin nada que leer: va al
 * tablero (`fightComesFirst`, en `scene-director.js`), y la decisión sale sin pulsar «Continuar».
 *
 * Mientras se abre una campaña (el cambio de chat), todavía no: su primera escena aún no está en
 * cola, y la pelea saldría antes que ella.
 *
 * @returns {boolean}
 */
export function fightWaitingHere() {
    if (combatEncounter.active) {
        noteSeenHere();
        return false;
    }
    if (deciding || placingNow()) return true;
    // Otro tablero (o se ha salido y se vuelve a entrar): una visita nueva.
    if (seenHere && (seenHere.board !== currentBoardName || seenHere.location !== currentLocationName)) seenHere = null;
    if (seenHere || isChatSwitching()) return false;
    if (!currentBoardName || lastWaiting.board !== currentBoardName || lastWaiting.placements.length === 0) return false;
    if (isBoardWon(currentLocationName, currentBoardName) || !partyMembers.some(m => !m.dead)) return false;
    const board = getActiveBoardContext().board;
    // J12.7: una pelea de taberna o un duelo se decide en la taberna, no aquí.
    return Boolean(board && !board.brawl);
}

/**
 * Si el tablero se ve ahora: en el Modo Juego, su escena; fuera, su panel.
 *
 * @returns {boolean}
 */
function boardInSight() {
    if (isShellOpen()) return document.querySelector('#game-shell')?.getAttribute('data-scene') === 'combat';
    const panel = document.querySelector('#world_location_maps_list');
    return panel instanceof HTMLElement && panel.offsetParent !== null;
}

/**
 * Si algo de delante tapa el tablero un momento (una ventana, la pausa): se mira otra vez luego.
 * V5 de las vueltas: también una escena del hilo que espera su turno (la que abre 1387, «El
 * cáliz ensangrentado», salía encima de colocarse). Primero la historia, luego la pelea.
 *
 * @returns {boolean}
 */
function somethingInFront() {
    return Boolean(document.querySelector('dialog[open]')) || document.body.classList.contains('game-shell-paused')
        || Boolean(document.querySelector('.popup:not([closing])[open]')) || scenesPending > 0;
}

/**
 * Mirar, cuando acabe de dibujarse el tablero, si los que esperan os han visto. Lo llama el
 * tablero cada vez que se dibuja, y el Modo Juego al cambiar de escena.
 */
export function noticeBoardFight() {
    // Lo que se estaba colocando en otro tablero (o en otra partida) se olvida.
    if (pending && (pending.board !== currentBoardName || pending.location !== currentLocationName || combatEncounter.active)) {
        dropPlacement();
    }
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
        scheduled = false;
        void openFightIfNoticed();
    }, 0);
}

/**
 * La pelea que espera en el tablero abierto, si os han visto: la decisión o, sin otras salidas,
 * colocarse.
 *
 * @returns {Promise<void>}
 */
async function openFightIfNoticed() {
    if (pending || deciding || combatEncounter.active) return;
    if (!currentBoardName || lastWaiting.board !== currentBoardName || lastWaiting.placements.length === 0) return;
    if (isBoardWon(currentLocationName, currentBoardName)) return;
    if (!boardInSight()) return;
    // Tanda 22 (H15 y el cáliz de 1387 desde el tablón): mientras se abre una campaña (el cambio de
    // chat), su primera escena aún no está en cola (`beginCampaignPlot` va al final), y con el grupo
    // ya hecho no hay `fightWait` que la espere: la pelea salía antes, se ganaba y la escena se
    // daba por pasada. Se mira otra vez al acabar el cambio; entonces la escena ya espera delante.
    if (somethingInFront() || isChatSwitching()) {
        setTimeout(() => noticeBoardFight(), 900);
        return;
    }
    // J9.1: una partida nueva desde el menú abre su tablero de salida antes de crear al héroe
    // (1387: el cuarto de la posada, con Torres a la vista). Con el grupo aún vacío, la decisión
    // salía ya, con todas las salidas cerradas («No queda nadie en pie para intentarlo») y antes
    // que la escena del cáliz. Se espera a que haya alguien, y luego un respiro para su escena.
    const wait = fightWait(partyMembers.length, waitedForParty);
    waitedForParty = wait.waited;
    if (wait.delay > 0) {
        setTimeout(() => noticeBoardFight(), wait.delay);
        return;
    }
    const board = getActiveBoardContext().board;
    // J12.7: una pelea de taberna o un duelo ya se ha decidido en la taberna (`party/brawl.js`).
    if (!board || board.brawl) return;
    const placements = [...lastWaiting.placements];
    const ways = avoidFor(board, foesOf(placements)).length;
    const opening = fightOpening({ ways });
    opened++;
    noteSeenHere();
    if (!opening.decide) {
        beginPlacement({ placements });
        return;
    }
    deciding = true;
    try {
        await openAvoidChoice({ auto: true, onFight: (/** @type {any[]} */ awake, /** @type {{enemiesFirst?: boolean}} */ how = {}) => fightFromChoice(awake, how) });
    } catch (error) {
        console.error('[pelea] no se pudo abrir la decisión', error);
    } finally {
        deciding = false;
    }
}

/**
 * Lo que pasa al elegir pelear (o al salir mal otra salida): colocarse, o si os han pillado,
 * empiezan ellos ya.
 *
 * @param {Array<{name: string, x: number, y: number}>} placements
 * @param {{enemiesFirst?: boolean}} how
 */
function fightFromChoice(placements, { enemiesFirst = false } = {}) {
    const opening = fightOpening({ caught: enemiesFirst });
    if (!opening.place) {
        startWaitingFight(placements, { enemiesFirst: true });
        return;
    }
    beginPlacement({ placements });
}

/**
 * Tanda 10: una sala que despierta al abrir su puerta, sin pelea en marcha. Directo a colocarse,
 * alrededor de donde está el grupo. Lo llama `wakeRoomEnemies`.
 *
 * @param {Array<{name: string, x: number, y: number}>} placements Los que dormían en la sala.
 * @returns {boolean} Si se encarga (si no, la sala abre su pelea como siempre).
 */
export function beginAmbushPlacement(placements) {
    if (combatEncounter.active || pending || !currentBoardName || !Array.isArray(placements) || placements.length === 0) return false;
    const templates = getCurrentWorldEnemies();
    if (!placements.some(p => templates.some(t => String(t.name).toLowerCase() === String(p.name).toLowerCase()))) return false;
    const names = placements.map(p => `${p.name} (${Number(p.x) + 1}, ${Number(p.y) + 1})`).join(', ');
    postCombatNarration(`⚠️ [COMBAT] ¡Emboscada! Se despierta lo que dormía en la sala: ${names}.`);
    return beginPlacement({ placements, ambush: true });
}

/**
 * Los del grupo que se colocan: vivos y en este sitio (J12.7: y, si se dice, solo esos).
 *
 * @param {string[]|null} [only] Por defecto, los de la pelea que se coloca ahora.
 * @returns {Array<{id: string, name: string, x: number, y: number, locked: boolean, member: any}>}
 */
function placers(only = pending?.only ?? null) {
    return partyMembers
        .filter(m => !m.dead && (Number(m.hp) || 0) > 0
            && (!only || only.includes(String(m.id)))
            && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName))
        .map(m => ({
            id: String(m.id),
            name: String(m.name),
            x: Number(m.mapPosition?.gridX) || 0,
            y: Number(m.mapPosition?.gridY) || 0,
            locked: controlOf(m) === 'engine',
            member: m,
        }));
}

/**
 * Empezar a colocarse.
 *
 * @param {Object} input
 * @param {Array<{name: string, x: number, y: number}>} input.placements
 * @param {boolean} [input.ambush]
 * @param {string} [input.said]
 * @param {(() => void)|null} [input.start] J12.7: lo que empieza la pelea, si no son los que esperan.
 * @param {string[]|null} [input.only] J12.7: los únicos del grupo que se colocan (por id).
 * @param {string} [input.title] J12.7: lo que dice la barra, si no es lo de siempre.
 * @param {string} [input.hint]
 * @param {(() => void)|null} [input.onDrop] J12.7: si se olvida sin empezar.
 * @returns {boolean} Si ha empezado.
 */
export function beginPlacement({ placements, ambush = false, said = '', start = null, only = null, title = '', hint = '', onDrop = null }) {
    if (combatEncounter.active) return false;
    const { board, terrain, gridWidth, gridHeight } = getActiveBoardContext();
    if (!board) return false;
    noteSeenHere();
    const launch = start ?? (() => startWaitingFight(placements, said ? { said } : {}));
    const people = placers(only);
    if (people.length === 0) {
        launch();
        return true;
    }
    const traps = [...knownTrapsHere()].map(key => parseCellKey(key)).filter(cell => cell !== null);
    const cells = startCells({
        terrain, gridWidth, gridHeight,
        starts: Array.isArray(board.partyStart) ? board.partyStart : [],
        party: people,
        enemies: placements,
        blocked: /** @type {Array<{x: number, y: number}>} */ (traps),
        ambush,
    });
    if (cells.length < people.length) {
        // Sin sitio para todos, se empieza donde está cada uno: mejor eso que un grupo a medias.
        launch();
        return true;
    }
    const placement = defaultPlacement({ members: people, cells });
    for (const who of people) {
        const at = placement[who.id];
        if (!at) continue;
        who.member.mapPosition = { ...(who.member.mapPosition ?? {}), locationName: currentLocationName, gridX: at.x, gridY: at.y };
    }
    savePartyState();
    pending = {
        board: currentBoardName,
        location: currentLocationName,
        placements: [...placements],
        ambush,
        cells,
        placement,
        selected: people.find(p => !p.locked)?.id ?? '',
        said,
        bar: null,
        start,
        only: only ? only.map(String) : null,
        title: String(title || ''),
        hint: String(hint || ''),
        onDrop,
    };
    setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
    showBar();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    return true;
}

/** Lo que enseña la barra ahora. */
function barView() {
    const now = /** @type {PendingFight} */ (pending);
    const people = placers();
    const chosen = people.find(p => p.id === now.selected);
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches === true;
    return {
        title: now.title || (now.ambush ? '¡Emboscada!' : 'Colocad al grupo'),
        hint: now.hint || placementHint({ ambush: now.ambush, selected: chosen?.name ?? '', touch }),
        ambush: now.ambush,
        members: people.map(p => ({
            id: p.id,
            name: p.name,
            face: faceOf(p.member),
            locked: p.locked,
            selected: p.id === now.selected,
        })),
    };
}

/**
 * La cara de alguien del grupo: la suya, o su retrato en pixel.
 *
 * @param {any} member
 * @returns {string}
 */
function faceOf(member) {
    const drawn = tokenArt({
        name: String(member?.name ?? ''), avatar: String(member?.avatar ?? ''),
        className: member?.class, gender: member?.gender, race: member?.race,
    });
    if (drawn) return drawn;
    const own = String(member?.avatar ?? '');
    return isPlainFace(own) ? '' : own;
}

/** La barra, montada o al día. */
function showBar() {
    if (!pending) return;
    if (pending.bar) {
        pending.bar.update(barView());
        return;
    }
    document.querySelector('#game-shell')?.classList.add('cv-placing');
    pending.bar = mountPlacementBar({
        view: barView(),
        onSelect: (id) => selectPlacer(id),
        onStart: () => confirmPlacement(),
        mount: isShellOpen() ? /** @type {HTMLElement|null} */ (document.querySelector('#game-shell')) : null,
    });
}

/**
 * Olvidar lo que se estaba colocando (se ha ido del tablero, o ha empezado otra pelea).
 *
 * @param {{started?: boolean}} [options] `started`: se olvida porque empieza (no se deshace nada).
 */
function dropPlacement({ started = false } = {}) {
    const dropped = pending;
    pending?.bar?.destroy();
    pending = null;
    document.querySelector('#game-shell')?.classList.remove('cv-placing');
    if (!started && dropped?.onDrop) {
        try {
            dropped.onDrop();
        } catch (error) {
            console.error('[pelea] no se pudo deshacer la pelea a medio colocar', error);
        }
    }
}

/**
 * Elegir a quién colocar.
 *
 * @param {string} id
 */
function selectPlacer(id) {
    if (!pending) return;
    const who = placers().find(p => p.id === String(id));
    if (!who) return;
    if (who.locked) {
        toastr.info(`A ${who.name} lo coloca el juego.`, 'Colocarse');
        return;
    }
    pending.selected = who.id;
    showBar();
    renderLocationMapsPreview();
}

/**
 * Poner a alguien en una casilla de salida.
 *
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function moveTo(id, x, y) {
    if (!pending) return false;
    const people = placers();
    const result = placeMember({ placement: pending.placement, id, to: { x, y }, cells: pending.cells, members: people });
    if (!result.ok) {
        toastr.info(result.reason, 'Colocarse');
        return false;
    }
    pending.placement = result.placement;
    for (const who of people) {
        const at = result.placement[who.id];
        if (at) who.member.mapPosition = { ...(who.member.mapPosition ?? {}), locationName: currentLocationName, gridX: at.x, gridY: at.y };
    }
    savePartyState();
    showBar();
    renderLocationMapsPreview();
    return true;
}

/**
 * «Empezar»: lo colocado se queda, y se tira la iniciativa.
 */
export function confirmPlacement() {
    if (!pending) return;
    // J9.1: lo colocado en un tablero del que ya se ha salido no empieza una pelea aquí fuera.
    if (pending.board !== currentBoardName || pending.location !== currentLocationName) {
        dropPlacement();
        if (isShellOpen()) refreshGameShell();
        return;
    }
    const done = pending;
    dropPlacement({ started: true });
    savePartyState();
    if (done.start) done.start();
    else startWaitingFight(done.placements, done.said ? { said: done.said } : {});
    if (isShellOpen()) refreshGameShell();
}

/**
 * Si se está colocando al grupo ahora, en el tablero abierto.
 *
 * @returns {boolean}
 */
export function placingNow() {
    return Boolean(pending) && pending?.board === currentBoardName && pending?.location === currentLocationName && !combatEncounter.active;
}

/**
 * Si la pelea del tablero abierto está decidiéndose o colocándose: mientras, la fila de fichas
 * no ofrece nada más.
 *
 * @returns {boolean}
 */
export function fightStarting() {
    return deciding || placingNow();
}

/**
 * Lo que enciende el tablero mientras se coloca: las casillas de salida, y el elegido.
 *
 * @returns {{selectedTokenId: number|null, highlightedTokenIds: number[], highlightedCells: Array<{gridX: number, gridY: number, kind: 'place'}>, overlayLegend: string}|null}
 */
export function placementHighlight() {
    if (!placingNow() || !pending) return null;
    const chosen = placers().find(p => p.id === pending?.selected);
    return {
        selectedTokenId: chosen ? Number(chosen.member.id) : null,
        highlightedTokenIds: [],
        // `place`: un toque coloca, también con el dedo (sin el primer toque que enseña la ruta).
        highlightedCells: pending.cells.map(c => ({ gridX: c.x, gridY: c.y, kind: /** @type {'place'} */ ('place') })),
        overlayLegend: chosen ? `Colocar a ${chosen.name}: pulsa una casilla azul` : 'Pulsa a uno de los tuyos para colocarlo',
    };
}

/**
 * Pulsar una casilla encendida mientras se coloca: la de uno de los tuyos lo elige; una libre
 * pone ahí al elegido.
 *
 * @param {number} x
 * @param {number} y
 * @returns {boolean} Si era de las suyas.
 */
export function placementCellClick(x, y) {
    if (!placingNow() || !pending) return false;
    const there = placers().find(p => p.x === x && p.y === y);
    if (there && there.id !== pending.selected) {
        selectPlacer(there.id);
        return true;
    }
    if (pending.selected) moveTo(pending.selected, x, y);
    return true;
}

/**
 * Pulsar una ficha mientras se coloca: una de las tuyas la elige.
 *
 * @param {number} tokenId
 * @returns {boolean} Si era de las suyas.
 */
export function placementTokenClick(tokenId) {
    if (!placingNow()) return false;
    if (Number(tokenId) >= 0) selectPlacer(String(tokenId));
    return true;
}

/**
 * Arrastrar una ficha mientras se coloca: soltarla en una casilla de salida la pone ahí.
 *
 * @param {number} tokenId
 * @param {number} x
 * @param {number} y
 * @returns {boolean} Si era de las suyas.
 */
export function placementDrop(tokenId, x, y) {
    if (!placingNow()) return false;
    if (Number(tokenId) >= 0 && moveTo(String(tokenId), x, y) && pending) {
        pending.selected = String(tokenId);
        showBar();
    }
    renderLocationMapsPreview();
    return true;
}

/**
 * Para las pruebas: cómo va la entrada en la pelea.
 *
 * @returns {{deciding: boolean, placing: boolean, ambush: boolean, cells: number, placement: Record<string, {x: number, y: number}>, selected: string, opened: number}}
 */
export function fightEntryState() {
    return {
        deciding,
        placing: placingNow(),
        ambush: Boolean(pending?.ambush),
        cells: pending?.cells.length ?? 0,
        placement: { ...(pending?.placement ?? {}) },
        selected: pending?.selected ?? '',
        opened,
    };
}
