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
import { isWatching } from '../game-engine/combat/brawl.js';
import { hitBarricade, pullLever } from '../game-engine/board/interactables.js';
import { isIndoors, carriesLight, combatVisibility } from '../game-engine/world/visibility.js';
import { stairsReached, nextLevel } from '../game-engine/board/dungeon-levels.js';
import { planWalk, canWalk } from '../game-engine/board/walk.js';
import { fireCellsOf } from '../game-engine/board/pathfinding.js';
import { planGroupMove, describeGroupMove } from '../game-engine/board/group-move.js';
export { walkFrames, hoverOf } from '../game-engine/board/group-move.js';
import { enterCell, describeHazard, passiveSpot } from '../game-engine/board/hazards.js';
import {
    walkPath, searchAround, canSearchAround, disarmable, tryDisarm, knownTrapCells,
} from '../game-engine/board/trap-actions.js';
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
import { applyTimedCondition, fieldLightOn } from './magic.js';
import { openChest } from './loot.js';
import { partyTabSetter } from './main.js';
import { lastWaiting, renderLocationMapsPreview } from './board-view.js';
import { saveCurrentLocation, saveCurrentBoard, getLocationBoards, hereLocation, weatherHere } from './world.js';
import { getCurrentSlotLabel } from './time.js';
import { getPlot } from './plot.js';
import { worldWrite } from './world-growth.js';
import { postCombatNarration, soundCue } from './narration.js';
import { savePartyState } from './roster.js';
import { getPartyFormation } from './companions.js';
import { inMarchOrder } from '../game-engine/campaign/formation.js';

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
        // J12.3: dónde ya se han buscado trampas, para no buscar dos veces lo mismo.
        if (Array.isArray(board.searchedCells)) stored.searchedCells = board.searchedCells;
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
 * J5.3: empezar una campaña en una localización sin tablero: la aldea de una campaña corta de tu
 * Gem, donde solo se habla y se comercia. El grupo está allí, sin tablero, y lo que se ve es el
 * sitio, con lo que se puede hacer y sus caminos, como en el pueblo del gremio.
 *
 * @param {string} locationName
 * @returns {boolean} Si existe esa localización.
 */
export function enterStartingLocation(locationName) {
    const location = getCurrentWorldLocationMaps().find(l => l.name === locationName);
    if (!location) return false;
    setCurrentLocationName(location.name);
    setCurrentBoardName('');
    saveCurrentLocation();
    saveCurrentBoard();
    for (const member of partyMembers.filter(m => !m.dead)) {
        member.mapPosition = { ...(member.mapPosition ?? { gridX: 0, gridY: 0 }), locationName: location.name };
    }
    savePartyState();
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
    // Tanda 8: el fuego a la vista (lo que arde en el tablero y las zonas de fuego), que el
    // camino rodea si hay por dónde.
    const hotCells = fireCellsOf({ hazards: board?.hazards, zones });
    return withOverlay(terrain, { elevation: normalizeElevation(board?.elevation), slowCells, blindCells, hotCells });
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

    // `board.rooms` es `any`: sin decirlo, `nameRoomsFromZones` devuelve salas sin sus puertas.
    const result = openDoor(normalizeTerrain(board.terrain), /** @type {import('../game-engine/campaign/campaign-map.js').Room[]} */ (rooms), gx, gy);
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
            // Su dibujo en pixel, también por su arquetipo del bestiario (J12.7: o el que trae
            // escrito quien espera sin plantilla, como los camorristas de una pelea de taberna).
            archetype: archetypeOf(template) || String(/** @type {any} */ (placement).archetype ?? '').trim(),
            // El jefe se ve antes de pelear: su corona.
            boss: Boolean(/** @type {any} */ (placement).boss || /** @type {any} */ (template)?.boss),
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
            boss: Boolean(/** @type {any} */ (e).boss),
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
        // J12.7: los que miran un duelo sí se ven, en la pared.
        if (combatEncounter.active && hasLeft(combatEncounter.left, m.id) && !isWatching(combatEncounter, m.id)) continue;
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
            // D-J52: o la cara sin arte que eligió.
            ...(m.face ? { face: m.face } : {}),
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

    // Dentro de un tablero, andar tiene reglas: hace falta camino y quien esta atado no se
    // mueve (tanda 10: sin enemigos alrededor, sin tope de pies). Fuera —en el mapa de la
    // localidad, que es un plano y no una rejilla de combate— colocarse sigue siendo libre.
    if (currentBoardName) {
        const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
        // J12.3: una trampa ya vista no se pisa a sabiendas; el camino la rodea.
        const traps = knownTrapsHere();
        if (traps.has(cellKey(gridX, gridY))) {
            toastr.warning('Ahí hay una trampa a la vista. Desarmadla antes, o id a otra casilla.', 'Ahí no');
            renderLocationMapsPreview();
            return;
        }
        const plan = planWalk({
            member,
            to: { x: gridX, y: gridY },
            terrain,
            gridWidth,
            gridHeight,
            occupied: [
                ...partyMembers
                    .filter(m => Number(m.id) !== Number(member.id))
                    .map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
                ...[...traps].map(key => parseCellKey(key)).filter(cell => cell !== null),
                // Tanda 10: y los enemigos que esperan quietos: no se anda por encima de nadie.
                ...waitingFoes(),
            ],
        });

        if (!plan.allowed) {
            toastr.warning(plan.reason, 'Ahi no se llega');
            renderLocationMapsPreview();
            return;
        }
        // J12.3: por el camino, sus trampas. Quien pisa una o ve una se queda ahí.
        const stop = walkTraps(member, plan.path);
        const at = plan.path[stop];
        if (at && stop < plan.path.length - 1) {
            gridX = at.x;
            gridY = at.y;
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
 * Tanda 10: las casillas de los enemigos que esperan quietos en el tablero abierto (los que el
 * grupo ve). Hasta que empieza la pelea no se mueven, y no se anda por encima de ellos.
 *
 * @returns {Array<{x: number, y: number}>}
 */
function waitingFoes() {
    if (combatEncounter.active || lastWaiting.board !== currentBoardName) return [];
    return lastWaiting.placements.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
}

/**
 * Mover al grupo entero fuera de combate a una casilla objetivo (J12.4).
 * Quien abre la marcha según la formación va a la casilla elegida por el camino más corto,
 * y los demás le siguen y se colocan a su alrededor detrás de él.
 *
 * @param {number} gridX
 * @param {number} gridY
 * @returns {import('../game-engine/board/group-move.js').GroupPlan|null}
 */
export function groupMoveTo(gridX, gridY) {
    if (!currentBoardName) {
        toastr.warning('No estás en un tablero de exploración.', 'Sin tablero');
        return null;
    }
    if (combatEncounter.active) {
        toastr.warning('En combate cada uno mueve en su turno.', 'En combate');
        return null;
    }
    const { terrain, gridWidth, gridHeight } = getActiveBoardContext();
    const members = partyMembers.filter(m => !m.dead).map(m => ({
        id: String(m.id),
        name: m.name,
        x: Number(m.mapPosition?.gridX) || 0,
        y: Number(m.mapPosition?.gridY) || 0,
        hp: m.hp,
        activeConditions: m.activeConditions || [],
    }));
    if (members.length === 0) return null;

    const enemies = [...getAliveEnemies().map(e => ({ x: Number(e.gridX) || 0, y: Number(e.gridY) || 0 })), ...waitingFoes()];
    const formation = getPartyFormation();
    const order = formation?.order || [];
    // J12.3: las trampas ya vistas no se pisan: la marcha las rodea, como a quien estorba.
    /** @type {Array<{x: number, y: number}>} */
    const traps = [];
    for (const key of knownTrapsHere()) {
        const cell = parseCellKey(key);
        if (cell) traps.push(cell);
    }
    const blocked = [...enemies, ...traps];

    let plan = planGroupMove({
        members,
        to: { x: gridX, y: gridY },
        terrain,
        gridWidth,
        gridHeight,
        order,
        blocked,
    });

    if (!plan.allowed) {
        toastr.warning(plan.reason, 'Marcha impedida');
        return plan;
    }

    // J12.3: quien abre la marcha anda su camino con sus trampas. Si pisa una o ve una, la marcha
    // se para donde se ha quedado él, y los demás se ponen detrás (o no se mueven, si no ha
    // llegado a dar un paso).
    const leadMove = plan.moves.find(move => move.id === plan.leader) ?? null;
    const leadMember = leadMove ? partyMembers.find(m => String(m.id) === String(leadMove.id)) : null;
    /** @type {{x: number, y: number}|null} */
    let leadStop = null;
    if (leadMove && leadMember) {
        const stop = walkTraps(leadMember, leadMove.path);
        if (stop < leadMove.path.length - 1) {
            leadStop = leadMove.path[stop];
            const stayed = stop === 0;
            const halted = stayed ? null : planGroupMove({ members, to: leadStop, terrain, gridWidth, gridHeight, order, blocked });
            plan = halted?.allowed
                ? { ...halted, moves: halted.moves.filter(move => move.id !== plan.leader), stopped: 'La marcha se para.' }
                : { ...plan, moves: [], stopped: 'La marcha se para.' };
        }
    }

    /**
     * @param {any} member
     * @param {{x: number, y: number}} to
     */
    const place = (member, to) => {
        member.mapPosition = member.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
        const from = { x: Number(member.mapPosition.gridX) || 0, y: Number(member.mapPosition.gridY) || 0 };
        member.mapPosition.gridX = to.x;
        member.mapPosition.gridY = to.y;
        if (currentLocationName) member.mapPosition.locationName = currentLocationName;
        noteZoneEntry(member, from, to);
    };
    if (leadMember && leadStop) place(leadMember, leadStop);
    for (const move of plan.moves) {
        const member = partyMembers.find(m => String(m.id) === String(move.id));
        if (!member) continue;
        // Los demás andan su propio camino: también pueden pisar una que nadie ha visto.
        const stop = move.id === String(leadMember?.id) ? move.path.length - 1 : walkTraps(member, move.path);
        place(member, move.path[stop] ?? move.to);
    }

    savePartyState();
    const desc = describeGroupMove(plan);
    if (desc) toastr.info(desc, 'Marcha del grupo');
    renderLocationMapsPreview();
    return plan;
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
        // J19.10: una Luz lanzada fuera de combate alumbra como un farol mientras dura.
        lit: carriesLight(partyMembers) || fieldLightOn(),
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

    for (const hazard of fired) applyHazardHit(member, hazard);

    savePartyState();
    renderLocationMapsPreview();
}

/**
 * Lo que le hace a alguien lo que acaba de saltar: el daño, el estado o, si no hace nada, que se
 * cuente. Una pista del caso (R6) no hace daño: pisarla es encontrarla.
 *
 * El motor decide y el narrador lo cuenta; y el aviso se ve también sin mirar el registro, que
 * fuera de combate nadie lo tiene abierto (J12.3).
 *
 * @param {any} member
 * @param {any} hazard
 */
function applyHazardHit(member, hazard) {
    if (hazard.kind === 'pista') {
        const state = readCases(chat_metadata?.[CASES_KEY]);
        const clue = state.active?.clues.find(c => `caso:${c.id}` === String(hazard.note));
        if (clue) revealClue(clue);
        return;
    }
    if (hazard.effect === 'damage' && hazard.damageDice) {
        const roll = rollWith(hazard.damageDice, nextRandom);
        member.hp = Math.max(0, (Number(member.hp) || 0) - roll.total);
        postCombatNarration(
            `[TABLERO] ${hazard.name} salta bajo ${member.name}: ${roll.total} de daño.`,
        );
        toastr.error(`${member.name} pisa ${String(hazard.name).toLowerCase()}: ${roll.total} de daño.`, '¡Una trampa!', { timeOut: 9000 });
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
        toastr.error(`${hazard.name} deja a ${member.name}: ${hazard.condition}.`, '¡Una trampa!', { timeOut: 9000 });
    } else {
        postCombatNarration(`[TABLERO] ${describeHazard(hazard)}.`);
    }
}

/**
 * La Percepción pasiva de alguien: lo que ve sin buscar (idea 78).
 *
 * @param {any} member
 * @returns {number}
 */
function passiveOf(member) {
    return 10 + skillModifier(member, 'perception').modifier;
}

/**
 * J12.3: las casillas con una trampa ya vista del tablero abierto. Quien anda las rodea: no se
 * pisa a sabiendas lo que se ha encontrado.
 *
 * @returns {Set<string>}
 */
export function knownTrapsHere() {
    const board = getActiveBoardContext().board;
    return board ? knownTrapCells(board) : new Set();
}

/**
 * J12.3: andar por un camino del tablero abierto, con sus trampas: la que no se ha visto salta al
 * pisarla (y quien anda se queda en ella); si de camino ve una, se para para decidir; ante una ya
 * vista, se para antes. Fuera de combate y en él: una trampa no sabe si hay pelea.
 *
 * @param {any} member
 * @param {Array<{x: number, y: number}>} path Con la casilla de salida.
 * @returns {number} El índice del camino donde se queda.
 */
export function walkTraps(member, path) {
    const steps = Array.isArray(path) ? path : [];
    const last = Math.max(0, steps.length - 1);
    const board = getActiveBoardContext().board;
    if (!board || steps.length < 2 || !Array.isArray(board.hazards) || board.hazards.length === 0) return last;
    const walk = walkPath({ board, path: steps, passive: passiveOf(member) });
    board.hazards = walk.hazards;
    for (const clue of walk.clues) applyHazardHit(member, clue);
    for (const hazard of walk.spotted) {
        const line = `${member.name} se fija: ${hazard.tell || describeHazard(hazard)} en (${hazard.x + 1}, ${hazard.y + 1}), y se para.`;
        postCombatNarration(`👁️ [TABLERO] ${line}`);
        toastr.warning(`${line} Se puede desarmar desde al lado, o dar un rodeo.`, 'Cuidado', { timeOut: 9000 });
    }
    if (walk.blockedBy) {
        toastr.info(`${member.name} se para: delante está ${String(walk.blockedBy.name).toLowerCase()}. Desarmadla o dad un rodeo.`, 'Una trampa a la vista');
    }
    for (const hazard of walk.fired) applyHazardHit(member, hazard);
    if (walk.fired.length > 0 || walk.spotted.length > 0 || walk.clues.length > 0) persistBoardTerrain(board);
    if (walk.fired.length > 0) {
        soundCue('hit');
        savePartyState();
    }
    return walk.stopAt;
}

/**
 * Quién del grupo está en el tablero abierto, vivo, con su casilla.
 *
 * @returns {Array<{member: any, x: number, y: number}>}
 */
function partyHere() {
    return partyMembers
        .filter(m => !m.dead && (Number(m.hp) || 0) > 0
            && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName))
        .map(m => ({ member: m, x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 }));
}

/**
 * El que mejor lo haría de una lista, por su habilidad.
 *
 * @param {any[]} members
 * @param {string} skill
 * @returns {any|null}
 */
function bestAt(members, skill) {
    return members.reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, skill).modifier > skillModifier(top, skill).modifier ? m : top), null);
}

/**
 * J12.3: buscar trampas alrededor del grupo, fuera de combate. Tira quien mejor mira
 * (Percepción), una vez por todos, y mira dos casillas alrededor de cada uno. Lo buscado se queda
 * buscado: para buscar más, hay que moverse.
 *
 * @returns {{found: number, fresh: boolean}|null} Nada si no hay tablero o hay pelea.
 */
export function searchForTraps() {
    const { board, gridWidth, gridHeight } = getActiveBoardContext();
    if (!board || !currentBoardName || combatEncounter.active) return null;
    const here = partyHere();
    const searcher = bestAt(here.map(h => h.member), 'perception');
    if (!searcher) return null;
    const total = rollDiceDetailed('1d20', 20).total + skillModifier(searcher, 'perception').modifier;
    /** @type {any} */
    let state = { hazards: board.hazards, searchedCells: board.searchedCells };
    /** @type {any[]} */
    const found = [];
    let missed = 0;
    let fresh = false;
    for (const spot of here) {
        const result = searchAround({ board: state, center: spot, roll: total, cols: gridWidth, rows: gridHeight });
        fresh ||= result.fresh;
        found.push(...result.found);
        missed += result.missed.length;
        state = { hazards: result.hazards, searchedCells: result.searched };
    }
    if (!fresh) {
        toastr.info('Aquí ya habéis buscado. Para buscar más, moveos a otra parte.', 'Buscar trampas');
        return { found: 0, fresh: false };
    }
    board.hazards = state.hazards;
    board.searchedCells = state.searchedCells;
    const where = (/** @type {any} */ h) => `${String(h.name).toLowerCase()} en (${h.x + 1}, ${h.y + 1})`;
    const said = found.length > 0
        ? `Encuentra ${found.map(where).join(' y ')}.`
        : missed > 0 ? 'Algo no encaja por aquí, pero no da con ello.' : 'No encuentra nada raro.';
    postCombatNarration(`🔍 [TABLERO] ${searcher.name} busca trampas alrededor (Percepción: ${total}). ${said}`);
    if (found.length > 0) {
        toastr.warning(found.map(h => `${h.name} (${h.x + 1}, ${h.y + 1}): ${h.tell || describeHazard(h)}`).join(' · '), `${searcher.name} encuentra ${found.length === 1 ? 'una trampa' : `${found.length} trampas`}`, { timeOut: 10000 });
    } else {
        toastr.info(said, `${searcher.name} busca trampas`);
    }
    persistBoardTerrain(board);
    renderLocationMapsPreview();
    return { found: found.length, fresh: true };
}

/**
 * J12.3: desarmar una trampa ya vista que alguien tiene al lado. Lo intenta el más mañoso de los
 * que están pegados a ella (Juego de manos, más sus herramientas si las lleva). Fallar por cinco o
 * más la hace saltar en quien la toca.
 *
 * @param {string} id
 * @returns {boolean} Si se desarmó.
 */
export function disarmTrap(id) {
    const { board } = getActiveBoardContext();
    if (!board || combatEncounter.active) return false;
    const here = partyHere();
    const choice = disarmable(board, here).find(c => c.hazard.id === String(id));
    if (!choice) {
        toastr.info('Hay que estar al lado de la trampa, y haberla visto.', 'Desarmar');
        return false;
    }
    const hazard = choice.hazard;
    const next = here.filter(h => Math.max(Math.abs(h.x - hazard.x), Math.abs(h.y - hazard.y)) <= 1).map(h => h.member);
    const who = bestAt(next, 'sleight');
    if (!who) return false;
    const tools = lockBonus(who);
    const roll = rollCheck({
        member: who, skill: 'sleight', rollD20: () => rollDiceDetailed('1d20', 20).total, dc: hazard.disarmDC,
        bonus: tools, bonusWhy: 'sus herramientas',
    });
    if (!roll) return false;
    const result = tryDisarm(board, hazard.id, roll.total);
    board.hazards = result.hazards;
    postCombatNarration(`🛠️ [TABLERO] ${roll.said}. ${result.reason}`);
    if (result.ok) {
        toastr.success(result.reason, `${who.name} desarma la trampa`);
    } else if (result.sprung) {
        applyHazardHit(who, hazard);
        savePartyState();
    } else {
        toastr.info(`${result.reason} Se puede volver a intentar.`, `${who.name} no puede con ella`);
    }
    persistBoardTerrain(board);
    renderLocationMapsPreview();
    return result.ok;
}

/**
 * J12.3: las fichas de las trampas para la fila de acciones, fuera de combate: desarmar la que
 * alguien tiene al lado y buscar alrededor (si queda algo sin buscar).
 *
 * @returns {Array<{id: string, label: string, icon: string, urgent?: boolean}>}
 */
export function boardTrapChips() {
    if (!currentBoardName || combatEncounter.active) return [];
    const { board, gridWidth, gridHeight } = getActiveBoardContext();
    if (!board) return [];
    const here = partyHere();
    if (here.length === 0) return [];
    /** @type {Array<{id: string, label: string, icon: string, urgent?: boolean}>} */
    const chips = disarmable(board, here).slice(0, 2).map(({ hazard }) => ({
        id: `trap-disarm:${hazard.id}`, label: `Desarmar: ${String(hazard.name).toLowerCase()}`, icon: 'fa-screwdriver-wrench', urgent: true,
    }));
    if (here.some(spot => canSearchAround({ board, center: spot, cols: gridWidth, rows: gridHeight }))) {
        chips.push({ id: 'trap-search', label: 'Buscar trampas', icon: 'fa-magnifying-glass' });
    }
    return chips;
}

/**
 * Lo que hace pulsar una ficha de trampas (`boardTrapChips`).
 *
 * @param {string} id
 * @returns {boolean} Si era de las suyas.
 */
export function runTrapChip(id) {
    const chip = String(id ?? '');
    if (chip === 'trap-search') {
        searchForTraps();
        return true;
    }
    if (chip.startsWith('trap-disarm:')) {
        disarmTrap(chip.slice('trap-disarm:'.length));
        return true;
    }
    return false;
}

/**
 * J12.11: la sala con nombre en la que está alguien, con su nota, o nada.
 *
 * @param {any} member
 * @returns {{name: string, note: string}|null}
 */
export function roomOf(member) {
    const board = getActiveBoardContext().board;
    if (!board || !member || !Array.isArray(board.zones) || board.zones.length === 0) return null;
    const here = zoneAt(board, Number(member.mapPosition?.gridX) || 0, Number(member.mapPosition?.gridY) || 0);
    return here?.name ? { name: String(here.name), note: String(here.note ?? '') } : null;
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
    // J7.4: si se eligió el orden de marcha, el de delante en la primera casilla.
    const formation = getPartyFormation();
    const alive = partyMembers.filter(m => !m.dead);
    (formation.order.length > 0 ? inMarchOrder(formation, alive) : alive).forEach((member, index) => {
        const cell = starts[index] ?? starts[0];
        member.mapPosition = { locationName: currentLocationName, gridX: Number(cell?.x) || 0, gridY: Number(cell?.y) || 0 };
    });
    savePartyState();
    // J12.11: si se empieza dentro de una sala con nombre, su nota, como al entrar andando.
    const leader = partyMembers.find(m => !m.dead);
    if (leader && board?.name === currentBoardName) noteZoneEntry(leader, null, { x: Number(leader.mapPosition?.gridX) || 0, y: Number(leader.mapPosition?.gridY) || 0 });
}
