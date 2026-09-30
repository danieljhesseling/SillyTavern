/**
 * El tablero: entrar en uno, el terreno y las puertas, las fichas de cada uno, los tableros ya
 * ganados, lo que se dispara al pisar y lo que se ve.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import {
    getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies, getCurrentWorldNPCs, loadWorldInfo,
    saveWorldInfo, METADATA_KEY,
} from '../world-info.js';
import { rollWith } from '../game-engine/combat/seeded-random.js';
import { rollDiceDetailed, getDistanceInFeet, getPlayerDamageFormula, nextRandom } from './combat-rules.js';
import { weaponOf as heldWeapon } from '../game-engine/rules/equipment.js';
import {
    normalizeTerrain, setDoorOpen, parseCellKey, getCell, isLocked, unlockDoor, breakDoor, withOverlay, cellKey,
} from '../game-engine/board/terrain.js';
import { normalizeElevation } from '../game-engine/board/heights.js';
import { zoneAt, nameRoomsFromZones } from '../game-engine/board/zones.js';
import { zoneFlagsAt, zonesAt, zoneEffects, resolveZoneEffect, kindOf } from '../game-engine/board/spell-zones.js';
import { getRayCells } from '../game-engine/board/line-of-sight.js';
import { visibilityPenalties } from '../game-engine/world/visibility.js';
import { getAbilityModifier } from '../dnd-system.js';
import { lockBonus } from '../game-engine/rules/field-uses.js';
import { hasLeft } from '../game-engine/board/exits.js';
import { hitBarricade, pullLever } from '../game-engine/board/interactables.js';
import { isIndoors, carriesLight, combatVisibility } from '../game-engine/world/visibility.js';
import { stairsReached, nextLevel } from '../game-engine/board/dungeon-levels.js';
import { planWalk, canWalk } from '../game-engine/board/walk.js';
import { enterCell, describeHazard, passiveSpot } from '../game-engine/board/hazards.js';
import { statusMarkers, sizeToCells } from '../game-engine/combat/initiative-tracker.js';
import { hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { holdDuringCombat } from '../game-engine/combat/combat-hold.js';
import { rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import { readCases } from '../game-engine/campaign/cases.js';
import { readPlotState } from '../game-engine/campaign/plot.js';
import { roleOf } from '../game-engine/combat/crits.js';
import { deriveRooms, openDoor, normalizeRooms } from '../game-engine/campaign/campaign-map.js';
import { BOARDS_WON_KEY, CASES_KEY, PLOT_STATE_KEY } from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCurrentBoardName,
    setCurrentLocationName,
} from './state.js';
import { revealClue } from './cases.js';
import { getAliveEnemies, getCurrentTurnEntry, getPartyMemberByTurnEntry, saveCombatState } from './combat-state.js';
import { damagePartyMember } from './enemy-turn.js';
import { applyFall, wakeRoomEnemies } from './combat-flow.js';
import { applyTimedCondition } from './magic.js';
import { openChest } from './loot.js';
import { partyTabSetter } from './main.js';
import { renderLocationMapsPreview } from './board-view.js';
import { saveCurrentLocation, saveCurrentBoard, getLocationBoards, hereLocation, weatherHere } from './world.js';
import { getCurrentSlotLabel } from './time.js';
import { getPlot } from './plot.js';
import { worldWrite } from './world-growth.js';
import { postCombatNarration, soundCue } from './narration.js';
import { savePartyState } from './roster.js';

/**
 * Writes terrain and fog back into the world info file that owns the board.
 *
 * The board object handed around is a reference into the loaded world data, so the edit is
 * already visible; this is what makes it survive a reload.
 *
 * @param {any} board
 */
export function persistBoardTerrain(board) {
    // En la fila de escrituras del mundo: abrir una puerta mientras llega gente nueva al
    // sitio guardaba dos copias del mundo, y la ultima borraba a la otra.
    return worldWrite(() => persistBoardTerrainNow(board));
}

/**
 * @param {any} board
 * @returns {Promise<void>}
 */
async function persistBoardTerrainNow(board) {
    if (!currentLocationName || !board) return;
    try {
        const worldName = chat_metadata?.[METADATA_KEY];
        if (!worldName) return;
        const data = await loadWorldInfo(worldName);
        if (!data?.metadata) return;

        // Los tableros viven colgados de su localizacion; la lista global es la forma
        // antigua, y solo la usan los mundos de antes. Mirar solo ahi hacia que pintar
        // terreno en un tablero de localizacion no guardara nada, en silencio.
        const globalBoards = Array.isArray(data.metadata.boards) ? data.metadata.boards : [];
        const locationBoards = (Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [])
            .flatMap((/** @type {any} */ l) => (Array.isArray(l?.boards) ? l.boards : []));
        const stored = [...locationBoards, ...globalBoards]
            .find((/** @type {any} */ b) => b?.name === board.name);
        if (!stored) return;

        stored.terrain = board.terrain;
        stored.fog = board.fog;
        stored.fogEnabled = board.fogEnabled;
        // Lo que arde o se ha descubierto (ideas 23 y 122): sin esto, un charco de aceite
        // desaparecía al recargar.
        if (Array.isArray(board.hazards)) stored.hazards = board.hazards;
        // R6: y los refuerzos que ya llegaron, para que no vuelvan a llegar.
        if (Array.isArray(board.waves)) stored.waves = board.waves;
        // Y los tesoros de la misión ya sacados de sus cofres.
        if (Array.isArray(board.collectedTreasures)) stored.collectedTreasures = board.collectedTreasures;
        // Que salas se han revelado es parte del estado del tablero: sin esto, una
        // mazmorra se volveria a cerrar sola al recargar.
        if (board.rooms) stored.rooms = board.rooms;
        // J12.11: las salas cuya nota ya se leyó al entrar, para no leerla cada vez.
        if (Array.isArray(board.zonesSeen)) stored.zonesSeen = board.zonesSeen;
        await saveWorldInfo(worldName, data);
    } catch (e) {
        console.warn('[party] could not persist board terrain', e);
    }
}

/**
 * Terrain of the board the party is standing on.
 *
 * Boards created before terrain existed simply have none, and an empty terrain behaves as
 * open floor — so movement highlighting is unchanged for them, and becomes wall-aware the
 * moment a board gains terrain.
 *
 * @returns {import('../game-engine/board/terrain.js').BoardTerrain}
 */
export function getActiveBoardTerrain() {
    return getActiveBoardContext().terrain;
}

/**
 * Puts the party on a board without going through /go and /enter.
 *
 * The campaign wizard uses this so a new campaign opens on its first board instead of
 * ending with a toast that tells you which two commands to type. It does exactly what
 * those commands do, minus the toasts, and refuses a location or board that does not
 * exist rather than leaving the panel pointing at nothing.
 *
 * @param {string} locationName
 * @param {string} boardName
 * @returns {boolean} whether both the location and the board were found
 */
export function enterStartingBoard(locationName, boardName) {
    const location = getCurrentWorldLocationMaps().find(l => l.name === locationName);
    if (!location) return false;

    const board = getLocationBoards(location).find((/** @type {any} */ b) => b.name === boardName);
    if (!board) return false;

    setCurrentLocationName(location.name);
    setCurrentBoardName(board.name);
    saveCurrentLocation();
    saveCurrentBoard();
    partyTabSetter?.('location');

    // The board lives in the party view of the right-hand panel, which starts closed and
    // showing the character editor instead. Entering a board you cannot see reads as
    // nothing having happened — which is exactly what the first version of the campaign
    // wizard looked like.
    //
    // The party icon in the top bar does this properly: it closes the persona drawer, opens
    // the panel and selects the party view, keeping selected_button in step. It never
    // toggles, so pressing it when the view is already showing is harmless. Opening the
    // panel by hand (#rightNavDrawerIcon) shows the wrong view.
    $('#partyDrawerIcon').trigger('click');
    return true;
}

/**
 * Terrain and dimensions of the board the party is standing on.
 *
 * The tactical planner needs all three together, and resolving them separately invited
 * passing a grid size from one board with the terrain of another.
 *
 * @returns {{terrain: import('../game-engine/board/terrain.js').BoardTerrain, gridWidth: number, gridHeight: number, board: any}}
 */
export function getActiveBoardContext() {
    const location = currentLocationName
        ? getCurrentWorldLocationMaps().find(l => l.name === currentLocationName)
        : null;
    const board = (currentLocationName && currentBoardName)
        ? getLocationBoards(location).find((/** @type {any} */ b) => b.name === currentBoardName)
        : null;

    const terrain = normalizeTerrain(board?.terrain);
    return {
        // Con lo que va encima mientras se juega: las cotas (J12.10) y las zonas de conjuro
        // (J19.6). Quien busca camino, mira o cuenta lo que cuesta una casilla lo ve solo.
        terrain: board ? overlayOf(terrain, board) : terrain,
        // El tamaño del tablero manda sobre el de su localización: un mapa en imagen (J12.8)
        // mide lo que mide su cuadrícula, y con los 50 × 50 del sitio sus casillas no caían
        // sobre las del dibujo.
        gridWidth: Number(board?.gridWidth) || Number(location?.gridWidth) || 50,
        gridHeight: Number(board?.gridHeight) || Number(location?.gridHeight) || 50,
        board: board ?? null,
    };
}

/**
 * J19.6: las zonas de conjuro del combate en marcha (niebla, telaraña, fuego…). Las pone quien
 * lanza el conjuro, en `combatEncounter.spellZones`; sin combate no hay ninguna.
 *
 * @returns {import('../game-engine/board/spell-zones.js').Zone[]}
 */
export function activeSpellZones() {
    const zones = /** @type {any} */ (combatEncounter).spellZones;
    return combatEncounter.active && Array.isArray(zones) ? zones : [];
}

/**
 * J19.5: las invocaciones del combate en marcha, en `combatEncounter.summons` (las fichas de
 * `planSummon`).
 *
 * @returns {import('../game-engine/rules/summons.js').SummonToken[]}
 */
export function activeSummons() {
    const summons = /** @type {any} */ (combatEncounter).summons;
    return combatEncounter.active && Array.isArray(summons) ? summons : [];
}

/**
 * Lo que va encima del terreno del tablero abierto (`withOverlay`): sus cotas y, en combate,
 * las casillas de zona que cuestan el doble o no dejan ver (`zoneFlagsAt`).
 *
 * @param {import('../game-engine/board/terrain.js').BoardTerrain} terrain
 * @param {any} board
 */
function overlayOf(terrain, board) {
    const zones = activeSpellZones();
    /** @type {string[]} */
    const slowCells = [];
    /** @type {string[]} */
    const blindCells = [];
    const seen = new Set();
    for (const zone of zones) {
        for (const cell of Array.isArray(zone?.cells) ? zone.cells : []) {
            const key = cellKey(cell.x, cell.y);
            if (seen.has(key)) continue;
            seen.add(key);
            const flags = zoneFlagsAt(zones, cell);
            if (flags.difficult) slowCells.push(key);
            if (flags.blocksSight) blindCells.push(key);
        }
    }
    return withOverlay(terrain, { elevation: normalizeElevation(board?.elevation), slowCells, blindCells });
}

/**
 * Lo que estorba un ataque de una casilla a otra: la niebla, la noche o el viento del sitio
 * (ideas 73 y 90) y, J19.6, una zona que no deja ver (niebla, oscuridad) donde está quien
 * ataca, donde está a quien ataca o en medio. Cada cosa es una desventaja con su motivo.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {number} distanceFeet
 * @returns {string[]}
 */
export function attackHindrance(from, to, distanceFeet) {
    const out = visibilityPenalties(boardVisibility(), distanceFeet);
    const zones = activeSpellZones();
    if (zones.length === 0) return out;
    const line = [from, ...getRayCells(from.x, from.y, to.x, to.y), to];
    for (const cell of line) {
        const blind = zonesAt(zones, cell).find(zone => kindOf(zone.kind).blocksSight);
        if (blind) return [...out, `no se ve: ${String(blind.name).toLowerCase()}`];
    }
    return out;
}

/**
 * J12.11: al entrar en una sala con nombre, lo que el tablero cuenta de ella. La primera vez
 * se lee su nota (quién espera, qué hay); después, nada: la nota ya está en el registro.
 *
 * @param {any} member
 * @param {{x: number, y: number}|null} from
 * @param {{x: number, y: number}} to
 * @returns {string} El nombre de la sala en la que ha entrado por primera vez, o vacío.
 */
export function noteZoneEntry(member, from, to) {
    const board = getActiveBoardContext().board;
    if (!board || !Array.isArray(board.zones) || board.zones.length === 0) return '';
    const here = zoneAt(board, to.x, to.y);
    if (!here?.name) return '';
    const before = from ? zoneAt(board, from.x, from.y) : null;
    if (before?.name === here.name) return '';
    const seen = Array.isArray(board.zonesSeen) ? board.zonesSeen : [];
    if (seen.includes(here.name)) return '';
    board.zonesSeen = [...seen, here.name];
    persistBoardTerrain(board);
    const who = String(member?.name ?? 'El grupo');
    postCombatNarration(`🚪 [TABLERO] ${who} entra en ${here.name}.${here.note ? ` ${here.note}` : ''}`);
    toastr.info(here.note || `${who} entra en ${here.name}.`, here.name, { timeOut: 9000, extendedTimeOut: 4000 });
    return here.name;
}

/**
 * J19.6: lo que le hacen las zonas de conjuro a quien las cruza, casilla a casilla (al entrar;
 * una vez por zona y turno). Se para en la casilla donde queda atrapado o cae.
 *
 * @param {any} member
 * @param {Array<{x: number, y: number}>} steps Las casillas que pisa, sin la de salida.
 * @returns {{stopAt: number, lines: string[]}} `stopAt`: el índice en `steps` donde se queda (el último si pasa entero).
 */
export function walkThroughSpellZones(member, steps) {
    const zones = activeSpellZones();
    /** @type {string[]} */
    const lines = [];
    if (zones.length === 0 || steps.length === 0) return { stopAt: steps.length - 1, lines };
    const turn = `${Number(combatEncounter.round) || 1}:${String(getCurrentTurnEntry()?.id ?? member?.id)}`;
    const memory = /** @type {any} */ (combatEncounter).zoneHits;
    const already = memory?.turn === turn && Array.isArray(memory.keys) ? [...memory.keys] : [];
    for (let index = 0; index < steps.length; index++) {
        const hits = zoneEffects({ zones, cell: steps[index], trigger: 'enter', who: String(member.id), alreadyThisTurn: already });
        for (const effect of hits) {
            already.push(effect.key);
            const result = resolveZoneEffect({
                effect,
                roll: (formula) => rollWith(formula, nextRandom),
                saveModifier: effect.save ? getAbilityModifier(Number(member?.[effect.save]) || 10) : 0,
                targetName: String(member.name),
            });
            lines.push(...result.lines);
            if (result.damage > 0) lines.push(...damagePartyMember(member, result.damage, false));
            if (result.condition) applyTimedCondition(member, String(member.id), result.condition, result.conditionRounds);
        }
        /** @type {any} */ (combatEncounter).zoneHits = { turn, keys: already };
        // Lo mismo que no deja andar fuera de combate (`walk.js`): atrapado, se queda ahí.
        if (hits.length > 0 && !canWalk(member).allowed) return { stopAt: index, lines };
    }
    return { stopAt: steps.length - 1, lines };
}

/**
 * T1 y B3: tirar de la palanca o golpear la barricada. Hace falta alguien al lado; en combate,
 * el que tiene el turno, y gasta su acción (como abrir un cofre a golpes no es gratis).
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {'lever'|'barricade'} kind
 */
function useBoardThing(board, gx, gy, kind) {
    const near = (/** @type {any} */ m) => Math.max(Math.abs((Number(m?.mapPosition?.gridX) || 0) - gx), Math.abs((Number(m?.mapPosition?.gridY) || 0) - gy)) <= 1;
    const acting = combatEncounter.active ? getPartyMemberByTurnEntry(getCurrentTurnEntry()) : null;
    const who = combatEncounter.active
        ? (acting && near(acting) && (Number(acting.hp) || 0) > 0 ? acting : null)
        : partyMembers.find(m => !m.dead && (Number(m.hp) || 0) > 0 && near(m));
    const what = kind === 'lever' ? 'la palanca' : 'la barricada';
    if (!who) {
        toastr.info(combatEncounter.active ? `Tiene que estar al lado de ${what} quien tiene el turno.` : `Hay que llegar al lado de ${what}.`, kind === 'lever' ? 'La palanca' : 'La barricada');
        return;
    }
    if (combatEncounter.active) {
        if (!hasAction(combatEncounter, 'action')) {
            toastr.info(`${who.name} ya ha usado su acción este turno.`, kind === 'lever' ? 'La palanca' : 'La barricada');
            return;
        }
        Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    }
    if (kind === 'lever') {
        const pulled = pullLever(normalizeTerrain(board.terrain));
        board.terrain = pulled.terrain;
        postCombatNarration(`🕹️ [TABLERO] ${who.name} tira de la palanca. ${pulled.line}`);
        if (pulled.opened.length > 0) soundCue('door');
        // Lo que había tras las rejas se ve, y lo que dormía despierta: abrir con la palanca
        // es abrir. Antes la reja se abría y la sala seguía a oscuras, con lo de dentro
        // dormido para siempre (el engendro del Sótano de la Iglesia, en Strahd).
        const { gridWidth, gridHeight } = getActiveBoardContext();
        for (const door of pulled.opened) toggleBoardDoor(board, door.x, door.y, true, gridWidth, gridHeight);
    } else {
        // Fuera de combate se rompe con calma, de una vez; en combate, con el daño del arma.
        const damage = combatEncounter.active ? Math.max(1, rollDiceDetailed(getPlayerDamageFormula(who, 5), 8).total) : 99;
        const hit = hitBarricade(normalizeTerrain(board.terrain), gx, gy, damage);
        board.terrain = hit.terrain;
        postCombatNarration(`🪓 [TABLERO] ${who.name} golpea la barricada${combatEncounter.active ? ` (−${damage})` : ''}. ${hit.line}`);
    }
    persistBoardTerrain(board);
    saveCombatState();
    renderLocationMapsPreview();
}

/**
 * R6: revientan barriles. Quien esté pegado a uno se lleva 2d6 de fuego.
 *
 * @param {Array<{x: number, y: number}>} cells
 * @returns {string[]}
 */
export function explodeBarrels(cells) {
    /** @type {string[]} */
    const lines = [];
    for (const cell of cells) {
        const blast = rollWith('2d6', nextRandom).total;
        const near = (/** @type {number} */ x, /** @type {number} */ y) => Math.max(Math.abs(x - cell.x), Math.abs(y - cell.y)) <= 1;
        const hit = [];
        for (const enemy of getAliveEnemies().filter(e => near(Number(e.gridX) || 0, Number(e.gridY) || 0))) {
            enemy.currentHp = Math.max(0, (Number(enemy.currentHp) || 0) - blast);
            hit.push(`${enemy.name}${enemy.currentHp === 0 ? ' (cae)' : ''}`);
        }
        for (const member of partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0 && near(Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0))) {
            lines.push(...damagePartyMember(member, blast, false));
            hit.push(String(member.name));
        }
        lines.push(`💥 Revienta un barril en (${cell.x + 1}, ${cell.y + 1}): ${blast} de fuego${hit.length > 0 ? ` a ${hit.join(', ')}` : ', y no pilla a nadie'}.`);
    }
    return lines;
}

/**
 * Abre o cierra una puerta del tablero.
 *
 * Abrir no es solo cambiar una casilla: revela la sala que guardaba y despierta lo que
 * dormia dentro. Ese es el ritmo de una mazmorra — el siguiente combate llega cuando tu
 * decides abrir.
 *
 * Vive aqui y no dentro del renderer porque la ficha de accion abre la misma puerta: dos
 * copias de esto serian dos sitios donde olvidarse de despertar la sala.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {boolean} open
 * @param {number} gridW
 * @param {number} gridH
 */
export function toggleBoardDoor(board, gx, gy, open, gridW, gridH) {
    // R6: un cofre se abre, no se cierra.
    if (getCell(normalizeTerrain(board?.terrain), gx, gy).type === 'chest') {
        openChest(board, gx, gy);
        return;
    }
    // T1 y B3: la palanca se tira; la barricada se golpea.
    const touched = getCell(normalizeTerrain(board?.terrain), gx, gy).type;
    if (touched === 'lever' || touched === 'barricade') {
        useBoardThing(board, gx, gy, touched);
        return;
    }
    if (open && isLocked(normalizeTerrain(board.terrain), gx, gy)) {
        void tryUnlock(board, gx, gy, gridW, gridH);
        return;
    }
    if (!open) {
        // Idea 23: una puerta rota ya no se cierra.
        if (getCell(normalizeTerrain(board.terrain), gx, gy).broken) {
            toastr.info('Está rota: ya no se cierra.', 'La puerta');
            return;
        }
        board.terrain = setDoorOpen(normalizeTerrain(board.terrain), gx, gy, false);
        persistBoardTerrain(board);
        soundCue('door');
        postCombatNarration(`[BOARD] La puerta de (${gx + 1}, ${gy + 1}) queda cerrada.`);
        renderLocationMapsPreview();
        return;
    }

    // J12.11: las salas llevan el nombre de su zona (B1, «La capilla»), también las de un
    // tablero guardado antes de tener zonas.
    const rooms = nameRoomsFromZones(normalizeRooms(board.rooms).length > 0
        ? board.rooms
        : deriveRooms(normalizeTerrain(board.terrain), gridW, gridH, {
            revealFrom: partyMembers.map(m => ({
                x: Number(m.mapPosition?.gridX) || 0,
                y: Number(m.mapPosition?.gridY) || 0,
            })),
        }), board.zones);

    const result = openDoor(normalizeTerrain(board.terrain), rooms, gx, gy);
    board.terrain = result.terrain;
    board.rooms = result.rooms;
    persistBoardTerrain(board);
    soundCue('door');
    const beyond = result.revealedRoom?.name ?? '';
    postCombatNarration(`[BOARD] La puerta de (${gx + 1}, ${gy + 1}) queda abierta${beyond ? `: da a ${beyond}` : ''}.`);

    if (result.revealedRoom) {
        wakeRoomEnemies(board, result.revealedRoom);
    }
    renderLocationMapsPreview();
}

/**
 * @param {string} location
 * @param {string} board
 * @returns {string}
 */
function boardKeyOf(location, board) {
    return `${String(location || '')}::${String(board || '')}`;
}

/**
 * Si la pelea que trae escrita este tablero ya se ganó.
 *
 * @param {string} location
 * @param {string} board
 * @returns {boolean}
 */
export function isBoardWon(location, board) {
    const won = chat_metadata?.[BOARDS_WON_KEY];
    return Array.isArray(won) && won.includes(boardKeyOf(location, board));
}

/**
 * Apuntar que la pelea escrita de un tablero se ganó: peleándola o, la prueba del gremio,
 * saltándola (J2.3), que cuenta igual.
 *
 * @param {string} location
 * @param {string} board
 */
export function recordBoardWon(location, board) {
    if (!chat_metadata || !String(board || '').trim() || isBoardWon(location, board)) return;
    const won = Array.isArray(chat_metadata[BOARDS_WON_KEY]) ? chat_metadata[BOARDS_WON_KEY] : [];
    chat_metadata[BOARDS_WON_KEY] = [...won, boardKeyOf(location, board)];
    saveMetadata();
}

/**
 * Quien espera en el tablero sin pelear todavía: los enemigos que trae escritos y que el grupo
 * ve. Antes solo salían al empezar el combate, y el texto decía que el alguacil y sus guardias
 * revientan la puerta sobre un tablero donde no había nadie (Daniel, 2026-09-28).
 *
 * @param {Array<{name: string, x: number, y: number}>} waiting
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
export function buildBoardIdleEnemyTokens(waiting) {
    const templates = getCurrentWorldEnemies();
    return waiting.map((placement, index) => {
        const template = templates.find(e => String(e.name).toLowerCase() === String(placement.name).toLowerCase());
        return {
            id: -(2000 + index),
            name: String(placement.name),
            avatar: template?.avatar ?? '',
            gridX: Number(placement.x) || 0,
            gridY: Number(placement.y) || 0,
            hp: Number(template?.maxHp) || undefined,
            maxHp: Number(template?.maxHp) || undefined,
            isEnemy: true,
            idle: true,
            // Su dibujo en pixel, también por su arquetipo del bestiario.
            archetype: archetypeOf(template),
        };
    });
}

/**
 * El arquetipo del bestiario de una plantilla de enemigo (`bestia-lobo`), si lo dice: para
 * su dibujo en pixel cuando su nombre no lo encuentra.
 *
 * @param {any} template
 * @returns {string}
 */
export function archetypeOf(template) {
    return String(template?.archetype ?? template?.from?.arquetipo ?? '').trim();
}

/**
 * J19.5: las invocaciones, como fichas del lado del grupo. Con el id de ficha que les da su
 * turno (`spell-turn.js`): así se eligen, se arrastran y se encienden como cualquiera del
 * grupo cuando les toca. La que aún no tiene turno, uno propio de -3000 hacia abajo, que no
 * pisa a los enemigos ni a la gente del tablero.
 *
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
export function buildSummonTokens() {
    return activeSummons()
        .filter(summon => (Number(summon?.hp) || 0) > 0)
        .map((summon, index) => {
            const own = /** @type {any} */ (summon);
            const turnId = own.summon && Number.isFinite(Number(own.id)) ? Number(own.id) : null;
            // Lo que se ha movido lo dice su casilla de grupo; la recién llegada, su `x`/`y`.
            const at = own.mapPosition ?? { gridX: summon.x, gridY: summon.y };
            return {
                id: turnId ?? -(3000 + index),
                name: String(summon.name),
                avatar: '',
                gridX: Number(at.gridX) || 0,
                gridY: Number(at.gridY) || 0,
                hp: Number(summon.hp) || 0,
                maxHp: Number(summon.maxHp) || Number(summon.hp) || 0,
                isSummon: true,
                // Su dibujo: el bicho del bestiario que es (el lobo de Conjurar animales).
                archetype: String(own.archetype ?? ''),
                statuses: statusMarkers(own.activeConditions),
                summoner: partyMembers.find(m => String(m.id) === String(summon.casterId))?.name ?? '',
            };
        });
}

/**
 * Idea 77: una puerta cerrada con llave. Con la llave se abre; si no, con maña o a golpes.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {number} gridW
 * @param {number} gridH
 * @returns {Promise<void>}
 */
async function tryUnlock(board, gx, gy, gridW, gridH) {
    const key = partyMembers.flatMap(m => (m.items ?? []).map((/** @type {any} */ item) => ({ member: m, item })))
        .find(({ item }) => /llave|ganz[uú]a/i.test(String(item?.name ?? '')));
    const body = $('<div class="tr-setback"></div>');
    body.append($('<h3></h3>').text('Puerta cerrada con llave'));
    body.append($('<p></p>').text(key ? `${key.member.name} lleva ${key.item.name}.` : 'Nadie lleva la llave. Se puede abrir con maña o echarla abajo.'));
    const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: 'Dejarla',
        customButtons: [
            ...(key ? [{ text: `Usar ${key.item.name}`, result: 31, classes: ['lk-key'] }] : []),
            { text: 'Con maña (Juego de manos, CD 14)', result: 32, classes: ['lk-pick'] },
            { text: 'A golpes (Atletismo, CD 16)', result: 33, classes: ['lk-force'] },
        ],
    }).show();
    if (picked !== 31 && picked !== 32 && picked !== 33) return;
    let opened = picked === 31;
    if (!opened) {
        const skill = picked === 32 ? 'sleight' : 'athletics';
        const dc = picked === 32 ? 14 : 16;
        const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0)
            .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, skill).modifier > skillModifier(top, skill).modifier ? m : top), null);
        // R3: quien sabe usar la ganzúa lo tiene más fácil (+5, que se nota en la CD).
        const trick = skill === 'sleight' && who ? lockBonus(who) : 0;
        if (trick > 0) postCombatNarration(`🗝️ [BOARD] ${who.name} saca la ganzúa: la cerradura baja de CD ${dc} a ${dc - trick}.`);
        const roll = who ? rollCheck({ member: who, skill, rollD20: () => rollDiceDetailed('1d20', 20).total, dc: dc - trick }) : null;
        if (roll) postCombatNarration(roll.said);
        opened = Boolean(roll?.success);
        if (!opened) {
            toastr.info('La cerradura aguanta.', 'Puerta cerrada');
            return;
        }
    }
    // Idea 23: a golpes, la puerta no se abre: se rompe, y ya no se cierra.
    board.terrain = picked === 33
        ? breakDoor(normalizeTerrain(board.terrain), gx, gy)
        : unlockDoor(normalizeTerrain(board.terrain), gx, gy);
    persistBoardTerrain(board);
    if (picked === 33) postCombatNarration(`🪓 [BOARD] La puerta de (${gx + 1}, ${gy + 1}) salta a golpes: queda rota, y ya no se cierra.`);
    toggleBoardDoor(board, gx, gy, true, gridW, gridH);
}

/**
 * Build token data from combat encounter enemies.
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
export function buildEnemyTokens() {
    if (!combatEncounter.active) return [];
    /** @type {import('../world-map-renderer.js').TokenData[]} */
    const result = [];
    const templates = getCurrentWorldEnemies();
    combatEncounter.enemies.forEach((e, idx) => {
        result.push({
            id: -(idx + 1),
            name: e.name,
            avatar: e.avatar,
            gridX: e.gridX || 0,
            gridY: e.gridY || 0,
            hp: e.currentHp,
            maxHp: e.maxHp,
            isEnemy: true,
            // Idea 13: que se lea el tablero de un vistazo.
            role: roleOf(e),
            statuses: statusMarkers(e.activeConditions),
            sizeCells: sizeToCells(e.size),
            // Su dibujo en pixel: por su nombre o por el arquetipo de su plantilla.
            archetype: archetypeOf(/** @type {any} */ (e).archetype ? e : templates.find(t => String(t.id) === String(e.templateId))),
        });
    });
    return result;
}

/**
 * Build token data from board NPC placements.
 * @param {{npcPlacements: Array<any>}} board
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
export function buildBoardNPCTokens(board) {
    if (!board?.npcPlacements || !Array.isArray(board.npcPlacements)) return [];
    const worldNPCs = getCurrentWorldNPCs();
    /** @type {import('../world-map-renderer.js').TokenData[]} */
    const result = [];
    board.npcPlacements.forEach((placement, /** @type {any} */ idx) => {
        const npc = worldNPCs.find(/** @type {any} */ (n) => n.id === placement.npcId);
        if (!npc) return;
        result.push({
            id: -(1000 + idx),
            name: npc.name,
            avatar: npc.avatar,
            gridX: placement.gridX || 0,
            gridY: placement.gridY || 0,
            hp: npc.hp,
            maxHp: npc.maxHp,
            isNPC: true,
        });
    });
    return result;
}

/**
 * @param {number} tokenId - Negative token ID
 * @param {number} gridX
 * @param {number} gridY
 */
export function handleEnemyTokenMove(tokenId, gridX, gridY) {
    const idx = (-tokenId) - 1;
    if (idx >= 0 && idx < combatEncounter.enemies.length) {
        combatEncounter.enemies[idx].gridX = gridX;
        combatEncounter.enemies[idx].gridY = gridY;
        saveCombatState();
    }
}

/**
 * Build token data from party members for a specific location.
 * @param {string} [locationFilter] - Only include members at this location (empty = all)
 * @returns {import('../world-map-renderer.js').TokenData[]}
 */
export function buildTokens(locationFilter) {
    /** @type {import('../world-map-renderer.js').TokenData[]} */
    const result = [];
    // Los muertos no andan por el tablero: están en su tumba (idea 36).
    for (const m of partyMembers.filter(member => !member.dead)) {
        // B2: quien salió por una salida ya no está en este tablero mientras dure la pelea.
        if (combatEncounter.active && hasLeft(combatEncounter.left, m.id)) continue;
        const pos = m.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
        if (locationFilter && pos.locationName !== locationFilter) continue;
        result.push({
            id: m.id,
            name: m.name,
            avatar: m.avatar,
            gridX: pos.gridX || 0,
            gridY: pos.gridY || 0,
            level: m.level,
            className: m.class,
            // Para su retrato de relleno cuando no trae cara: el de su especie, clase y género.
            gender: String(m.gender ?? ''),
            race: String(m.race ?? ''),
            weapon: String(heldWeapon(m)?.name ?? ''),
            hp: m.hp,
            maxHp: m.maxHp,
            // Drawn over the token, so what is wrong with a character is visible on the
            // board and not only on the sheet.
            statuses: statusMarkers(m.activeConditions ?? m.conditions),
            sizeCells: sizeToCells(m.size),
        });
    }
    return result;
}

/**
 * Handle token move: update party member's mapPosition and save.
 * @param {number} tokenId
 * @param {number} gridX
 * @param {number} gridY
 * @param {string} [locationName]
 */
export function handleTokenMove(tokenId, gridX, gridY, locationName) {
    const member = partyMembers.find(m => m.id === tokenId);
    if (!member) return;

    // Dentro de un tablero, andar tiene reglas: hace falta camino, hay un alcance y quien
    // esta atado no se mueve. Fuera —en el mapa de la localidad, que es un plano y no una
    // rejilla de combate— colocarse sigue siendo libre.
    if (currentBoardName) {
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        const plan = planWalk({
            member,
            to: { x: gridX, y: gridY },
            terrain,
            gridWidth,
            gridHeight,
            occupied: partyMembers
                .filter(m => Number(m.id) !== Number(member.id))
                .map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
        });

        if (!plan.allowed) {
            toastr.warning(plan.reason, 'Ahi no se llega');
            renderLocationMapsPreview();
            return;
        }
    }

    member.mapPosition = member.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
    const from = { x: Number(member.mapPosition.gridX) || 0, y: Number(member.mapPosition.gridY) || 0 };
    member.mapPosition.gridX = gridX;
    member.mapPosition.gridY = gridY;
    if (locationName) member.mapPosition.locationName = locationName;
    savePartyState();
    // J12.11: si ha entrado en una sala con nombre, lo que se ve en ella.
    if (currentBoardName) noteZoneEntry(member, from, { x: gridX, y: gridY });
}

/**
 * Ideas 73 y 90: cómo se ve en el tablero ahora: el tiempo, la hora y si hay luz.
 *
 * @returns {{maxFeet: number|null, reasons: string[], windy: boolean, wet: boolean, note: string}}
 */
export function boardVisibility() {
    const { board } = getActiveBoardContext();
    return combatVisibility({
        weather: weatherHere(),
        slot: getCurrentSlotLabel(),
        indoors: isIndoors(board, hereLocation()),
        lit: carriesLight(partyMembers),
    });
}

/**
 * Idea 75: si alguien está en una escalera que baja.
 *
 * @returns {any|null} El tablero de abajo.
 */
export function stairsHere() {
    if (combatEncounter.active || !currentBoardName) return null;
    const context = getActiveBoardContext();
    const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const below = nextLevel(context.board, getLocationBoards(loc));
    if (!below) return null;
    const at = partyMembers.filter(m => !m.dead).map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 }));
    return stairsReached(context.terrain, at) ? below : null;
}

/**
 * Las puertas cerradas del tablero abierto, con lo lejos que le quedan al grupo.
 *
 * @returns {Array<{x: number, y: number, distance: number}>}
 */
export function closedDoorsNearParty() {
    if (!currentBoardName) return [];
    const context = getActiveBoardContext();
    const cells = context.terrain?.cells || {};

    /** @type {Array<{x: number, y: number, distance: number}>} */
    const doors = [];
    for (const [key, cell] of Object.entries(cells)) {
        if (!cell || cell.type !== 'door' || cell.open) continue;
        const parsed = parseCellKey(key);
        if (!parsed) continue;

        const distances = partyMembers.map(m => getDistanceInFeet(
            Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0,
            parsed.x, parsed.y));
        doors.push({
            x: parsed.x,
            y: parsed.y,
            distance: distances.length > 0 ? Math.min(...distances) : Number.MAX_SAFE_INTEGER,
        });
    }
    return doors;
}

/**
 * Los tableros de este sitio que la historia pide ganar ahora.
 *
 * @param {any} location
 * @returns {string[]}
 */
export function threadBoardsHere(location) {
    const plot = getPlot();
    if (!plot || !location) return [];
    const open = new Set(readPlotState(chat_metadata?.[PLOT_STATE_KEY]).open);
    const here = new Set(getLocationBoards(location).map((/** @type {any} */ b) => String(b.name)));
    return [...new Set(plot.milestones
        .filter(m => open.has(m.id) && m.asks?.kind === 'win' && here.has(String(m.asks.board ?? ''))
            && (!m.asks.place || String(m.asks.place).toLowerCase() === String(currentLocationName).toLowerCase())
            && !isBoardWon(currentLocationName, String(m.asks.board)))
        .map(m => String(m.asks.board)))];
}

/**
 * Lo que hay puesto en esa casilla, disparado.
 *
 * El motor decide que salta y cuanto duele; el narrador lo cuenta. Al reves —dejarselo al
 * modelo— es como acaban las trampas haciendo un dano distinto cada vez.
 *
 * Y el dado es el de la partida: una trampa que se saltara la semilla haria que dos
 * partidas con la misma semilla dejaran de salir iguales.
 *
 * @param {any} member
 * @param {number} x
 * @param {number} y
 */
export function fireHazardsOnEnter(member, x, y) {
    const board = getActiveBoardContext().board;
    if (!board) return;

    const { fired, hazards } = enterCell(board, { x, y });
    board.hazards = hazards;

    // Idea 78: lo que hay al lado se ve sin buscarlo, si se tiene buen ojo.
    const passive = 10 + skillModifier(member, 'perception').modifier;
    const spotted = passiveSpot(board, { x, y }, passive);
    if (spotted.spotted.length > 0) {
        board.hazards = spotted.hazards;
        for (const hazard of spotted.spotted) {
            const line = `${member.name} se fija: ${hazard.tell || describeHazard(hazard)} en (${hazard.x + 1}, ${hazard.y + 1}).`;
            postCombatNarration(`👁️ [TABLERO] ${line}`);
            toastr.warning(line, 'Cuidado', { timeOut: 8000 });
        }
    }
    if (fired.length === 0 && spotted.spotted.length === 0) return;
    persistBoardTerrain(board);
    if (fired.length === 0) {
        renderLocationMapsPreview();
        return;
    }

    for (const hazard of fired) {
        // R6: una pista del caso, puesta en el tablero: pisarla es encontrarla.
        if (hazard.kind === 'pista') {
            const state = readCases(chat_metadata?.[CASES_KEY]);
            const clue = state.active?.clues.find(c => `caso:${c.id}` === String(hazard.note));
            if (clue) revealClue(clue);
            continue;
        }
        if (hazard.effect === 'damage' && hazard.damageDice) {
            const roll = rollWith(hazard.damageDice, nextRandom);
            member.hp = Math.max(0, (Number(member.hp) || 0) - roll.total);
            postCombatNarration(
                `[TABLERO] ${hazard.name} salta bajo ${member.name}: ${roll.total} de daño.`,
            );
            // A cero manda la misma puerta de siempre: una sola forma de caer.
            // Lo que salta en el tablero dice de que es: fuego es fuego.
            if (member.hp === 0) applyFall(member, String(hazard.cause || ''));
        } else if (hazard.effect === 'condition' && hazard.condition) {
            member.activeConditions = Array.isArray(member.activeConditions)
                ? member.activeConditions : [];
            if (!member.activeConditions.includes(hazard.condition)) {
                member.activeConditions.push(hazard.condition);
            }
            postCombatNarration(
                `[TABLERO] ${hazard.name} deja a ${member.name}: ${hazard.condition}.`,
            );
        } else {
            postCombatNarration(`[TABLERO] ${describeHazard(hazard)}.`);
        }
    }

    savePartyState();
    renderLocationMapsPreview();
}

/**
 * Entrar en un tablero de la localizacion actual. Devuelve el nombre real, o ''.
 *
 * Extraido de `/enter`, con su respaldo para los mundos antiguos que guardaban los
 * tableros sueltos en vez de colgados de la localizacion.
 *
 * @param {string} name
 * @returns {string}
 */
export function enterBoard(name) {
    const held = holdDuringCombat(combatEncounter, 'board');
    if (held) {
        toastr.warning(held, 'Combate en marcha');
        return '';
    }

    const wanted = String(name || '').trim();
    if (!currentLocationName) return '';

    const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    let boards = getLocationBoards(loc);
    if (boards.length === 0) {
        const globalBoards = getCurrentWorldBoards();
        if (globalBoards.length > 0) {
            console.log('[party] enterBoard fallback to global boards', { currentLocationName, globalBoards });
            boards = globalBoards;
        }
    }

    const match = boards.find((/** @type {any} */ b) => b.name.toLowerCase() === wanted.toLowerCase());
    if (!match) return '';

    setCurrentBoardName(match.name);
    saveCurrentBoard();
    placePartyAtStart(match);
    return match.name;
}

/**
 * Al entrar en un tablero, el grupo se pone en sus casillas de inicio, como al empezar una
 * campaña: la casilla de otro tablero puede caer en un muro de este, o fuera del mapa.
 * Uno en cada casilla, por orden; si hay más gente que casillas, en la primera.
 *
 * @param {any} board
 * @returns {void}
 */
export function placePartyAtStart(board) {
    const starts = Array.isArray(board?.partyStart) ? board.partyStart : [];
    if (starts.length === 0 || combatEncounter.active) return;
    partyMembers.filter(m => !m.dead).forEach((member, index) => {
        const cell = starts[index] ?? starts[0];
        member.mapPosition = { locationName: currentLocationName, gridX: Number(cell?.x) || 0, gridY: Number(cell?.y) || 0 };
    });
    savePartyState();
    // J12.11: si se empieza dentro de una sala con nombre, su nota, como al entrar andando.
    const leader = partyMembers.find(m => !m.dead);
    if (leader && board?.name === currentBoardName) noteZoneEntry(leader, null, { x: Number(leader.mapPosition?.gridX) || 0, y: Number(leader.mapPosition?.gridY) || 0 });
}
