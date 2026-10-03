/**
 * El tablero en pantalla: el panel de la localización, las casillas encendidas, la paleta del
 * terreno, la tarjeta de un enemigo, los clics y el botón de empezar la pelea.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps, getCurrentWorldEnemies } from '../world-info.js';
import { renderWorldMapView, renderLocationView, tokenArt } from '../world-map-renderer.js';
import { zoneOverlay } from '../game-engine/board/spell-zones.js';
import { isPlainFace } from '../game-engine/ui/pixel-art.js';
import { normalizeElevation } from '../game-engine/board/heights.js';
import { normalizeZones } from '../game-engine/board/zones.js';
import { escapeHtml } from '../utils.js';
import {
    getDistanceInFeet, getAttackRangeFeet, getPlayerDamageFormula, getPlayerAttackModifier, getPlayerAttackParts,
} from './combat-rules.js';
import { describeAttackBonus } from '../game-engine/rules/attack-bonus.js';
import { weaponBonus } from '../game-engine/rules/equipment.js';
import {
    normalizeTerrain, setCell as setTerrainCell, getTerrainOptions, cellKey,
} from '../game-engine/board/terrain.js';
import { isArea } from '../game-engine/rules/area.js';
import { supportActions } from '../game-engine/campaign/pet.js';
import { pairOptions } from '../game-engine/rules/pair-moves.js';
import { getReachableCells, findPath, getPathCost } from '../game-engine/board/pathfinding.js';
import { createEmptyFog, normalizeFog, updateFog } from '../game-engine/board/fog-of-war.js';
import { fogOnFor } from '../game-engine/board/board-camera.js';
import { attackEdge, readManeuvers } from '../game-engine/combat/maneuvers.js';
import { perkBonus } from '../game-engine/rules/level-perks.js';
import { sightFeetFor } from '../game-engine/world/visibility.js';
import { describeForecast } from '../game-engine/combat/forecast.js';
import { canWalk } from '../game-engine/board/walk.js';
import { visibleHazards } from '../game-engine/board/hazards.js';
import { buildTracker, describeTurn } from '../game-engine/combat/initiative-tracker.js';
import { hasAction } from '../game-engine/combat/turn-machine.js';
import { holdDuringCombat } from '../game-engine/combat/combat-hold.js';
import { traitBonus } from '../game-engine/campaign/feats.js';
import { buildTargetCard, describeTargetCard } from '../game-engine/combat/target-card.js';
import { awakePlacements, revealThroughOpenDoors } from '../game-engine/campaign/campaign-map.js';
import { planUltimate } from '../game-engine/combat/bond-perks.js';
import { ultimateOf } from '../game-engine/combat/bond-moves.js';
import { combineEdge, hasVex } from '../game-engine/rules/weapon-mastery.js';
import { sneakBadge } from '../game-engine/rules/sneak-attack.js';
import { weaponOf } from '../game-engine/rules/equipment.js';
import { sneakFor } from './combo-rules.js';
import { bondChoices, resolveBondMove } from './bond-play.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { createCombatLogPanel, setRound, renderLogFilters, logFilterOf } from '../game-engine/ui/combat-log.js';
import { usesLeft, canUseAbility, describeAbility } from '../game-engine/rules/abilities.js';
import { findOpportunityAttacks } from '../game-engine/combat/opportunity.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { buildInitiative } from '../game-engine/ui/combat-vtt/initiative.js';
import { buildSummary } from '../game-engine/ui/combat-vtt/summary.js';
import { turnBannerText } from '../game-engine/ui/combat-vtt/turn-banner.js';
import { holdRedraw } from './combat-fx.js';
import { LOCATION_MAPS_MANUAL_HIDDEN_KEY } from './keys.js';
import {
    combatBoardSelection, combatEncounter, combatLogEntries, currentBoardName, currentLocationName, partyMembers,
    setCombatBoardSelection, setCurrentBoardName, setCurrentLocationName, usedReactions,
} from './state.js';
import { currentPet, petSupport } from './pet.js';
import { abilityVictims, carriedNames, getAbilityCatalogue, knownAbilitiesOf, useAbility } from './magic.js';
import {
    boardCellOf, getAliveEnemies, getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry,
    getCurrentTurnState, getPartyMemberByTurnEntry, getRemainingMovementFeet, getTargetArmorClass, heightFor,
    occupiedCellsFor, partyCell, partyFlanks, underYourHand,
} from './combat-state.js';
import { paintCombatLog } from './combat-log.js';
import { planFor } from './enemy-turn.js';
import {
    judgeCurrentScenario, restoreChatPlaceholder, controlChoices, chooseControlOf,
} from './combat-flow.js';
import { CONTROL_LABELS } from './spell-turn.js';
import {
    endPlayerCombatTurn, handlePlayerCombatAttack, handlePlayerCombatMove, resolvePairStrike,
    resolveUltimateStrike,
} from './player-actions.js';
import {
    boardVisibility, buildBoardIdleEnemyTokens, buildBoardNPCTokens, buildEnemyTokens, buildTokens,
    getActiveBoardContext, getActiveBoardTerrain, groupMoveTo, handleEnemyTokenMove, handleTokenMove, isBoardWon,
    persistBoardTerrain, placePartyAtStart, toggleBoardDoor, buildSummonTokens, activeSpellZones, attackHindrance,
    archetypeOf, activeSummons, knownTrapsHere, roomOf,
} from './board.js';
import { saveCurrentLocation, saveCurrentBoard, getLocationBoards } from './world.js';
import { keepTorchLit, lightCardLine, lightForBoard } from './dungeon.js';
import { getCampaignBonds } from './time.js';
import {
    noticeBoardFight, placementHighlight, placementCellClick, placementTokenClick, placementDrop, placingNow,
} from './fight-entry.js';

/** @type {boolean} */
export let locationMapsManuallyHidden = false;

export function loadLocationMapsVisibility() {
    try {
        locationMapsManuallyHidden = window.localStorage.getItem(LOCATION_MAPS_MANUAL_HIDDEN_KEY) === 'true';
    } catch {
        locationMapsManuallyHidden = false;
    }
}

/**
 * @param {boolean} hidden
 */
/**
 * Plegar o desplegar el panel de localizacion.
 *
 * El nombre dice "hidden" y no "visible" a proposito: se llamaba setLocationMapsVisibility
 * y recibia "hidden", asi que pasarle true lo ocultaba. El Modo Juego nacio plegado por eso.
 *
 * @param {boolean} hidden
 */
export function setLocationMapsHidden(hidden) {
    locationMapsManuallyHidden = Boolean(hidden);
    try {
        window.localStorage.setItem(LOCATION_MAPS_MANUAL_HIDDEN_KEY, String(locationMapsManuallyHidden));
    } catch (e) {
        console.warn('Unable to store location maps panel visibility', e);
    }
}

/**
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function getCombatBoardHighlightState(gridWidth, gridHeight) {
    // Tanda 10: antes de la iniciativa, el grupo se coloca: se encienden las casillas de salida.
    const placing = placementHighlight();
    if (placing) return placing;
    // J20.2 (y J12.4): fuera de combate también se elige una ficha y se ve a dónde puede ir; a
    // toques es la única forma de moverla, porque con el dedo no se arrastra. Tanda 10: sin
    // enemigos alrededor se anda libre, sin tope de pies.
    const walker = combatEncounter.active ? null : selectedWalker();
    if (walker) {
        const pos = walker.mapPosition || { gridX: 0, gridY: 0, locationName: '' };
        const occupied = walkBlockers(walker);
        return {
            selectedTokenId: walker.id,
            highlightedTokenIds: [],
            highlightedCells: getReachableCells(getActiveBoardTerrain(), pos.gridX || 0, pos.gridY || 0, Infinity, gridWidth, gridHeight, { occupied })
                .filter(cell => cell.gridX !== (pos.gridX || 0) || cell.gridY !== (pos.gridY || 0)),
            overlayLegend: `${walker.name} · Pulsa una casilla encendida para ir`,
        };
    }
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) {
        return { selectedTokenId: null, highlightedTokenIds: [], highlightedCells: [], overlayLegend: '' };
    }

    const isSelected = combatBoardSelection.tokenId === member.id && combatBoardSelection.boardName === currentBoardName && combatBoardSelection.locationName === currentLocationName;
    if (!isSelected) {
        return { selectedTokenId: null, highlightedTokenIds: [], highlightedCells: [], overlayLegend: '' };
    }

    const remainingFeet = getRemainingMovementFeet(member);
    // Cuerpo a tierra, cada paso cuesta el doble (2024, `crawlCost` al andar en player-actions.js):
    // solo se encienden las casillas a las que se llega arrastrándose. Antes salían las de ir de
    // pie, y pulsarlas decía «Movimiento insuficiente».
    const crawling = (Array.isArray(member.activeConditions) ? member.activeConditions : []).includes('Prone');
    const reachFeet = crawling ? Math.floor(remainingFeet / 2) : remainingFeet;
    const pos = member.mapPosition || { gridX: 0, gridY: 0, locationName: '' };
    const attackable = getAttackableEnemiesForMember(member);
    /** @type {{gridX:number,gridY:number,kind:'attack'}[]} */
    const attackCells = attackable.map(enemy => ({ gridX: enemy.gridX || 0, gridY: enemy.gridY || 0, kind: 'attack' }));
    const movementCells = getReachableCells(
        getActiveBoardTerrain(), pos.gridX || 0, pos.gridY || 0, reachFeet, gridWidth, gridHeight,
        { occupied: new Set([...occupiedCellsFor(member), ...knownTrapsHere()]) },
    // La casilla en la que ya estas no es un sitio al que moverte: pulsarla gastaria
    // cero pies, y encendida solo servia para que tu propia ficha se comiera el clic.
    ).filter(cell => cell.gridX !== (pos.gridX || 0) || cell.gridY !== (pos.gridY || 0));
    const overlayLegend = `${member.name} · Te quedan ${remainingFeet} pies · Alcance ${getAttackRangeFeet(member)} pies${attackable.length ? ` · Objetivos: ${attackable.map(enemy => enemy.name).join(', ')}` : ' · Nadie al alcance'}`;

    return {
        selectedTokenId: member.id,
        highlightedTokenIds: attackable.map(enemy => -(combatEncounter.enemies.findIndex(candidate => candidate.instanceId === enemy.instanceId) + 1)).filter(id => id !== 0),
        highlightedCells: [...movementCells, ...attackCells],
        overlayLegend,
    };
}

/**
 * Fuera de combate, lo que no se pisa al andar: los demás del grupo, las trampas ya vistas
 * (J12.3: el camino las rodea) y, tanda 10, los enemigos que esperan quietos en el tablero.
 *
 * @param {any} walker
 * @returns {Set<string>}
 */
function walkBlockers(walker) {
    const occupied = new Set(partyMembers
        .filter(m => Number(m.id) !== Number(walker.id) && !m.dead)
        .map(m => cellKey(Number(m.mapPosition?.gridX) || 0, Number(m.mapPosition?.gridY) || 0)));
    for (const key of knownTrapsHere()) occupied.add(key);
    if (lastWaiting.board === currentBoardName) {
        for (const foe of lastWaiting.placements) occupied.add(cellKey(Number(foe.x) || 0, Number(foe.y) || 0));
    }
    return occupied;
}

/**
 * Fuera de combate, la ficha elegida en este tablero, si es de las que llevas tú y puede andar.
 *
 * @returns {import('./types.js').PartyMember|null}
 */
function selectedWalker() {
    if (!currentBoardName || combatBoardSelection.boardName !== currentBoardName
        || combatBoardSelection.locationName !== currentLocationName) return null;
    const id = combatBoardSelection.tokenId;
    if (id === null || !getControlledMemberIds().some(own => Number(own) === Number(id))) return null;
    return partyMembers.find(m => Number(m.id) === Number(id)) ?? null;
}

function getControlledMemberIds() {
    const linked = partyMembers.filter(m => m.personaId !== null).map(m => m.id);
    const yours = underYourHand(linked.length > 0 ? linked : partyMembers.map(m => m.id));

    // Y quien no puede andar tampoco se deja arrastrar: es mejor que la ficha no se
    // levante a que se levante, se suelte y entonces le digan que no. Sigue pudiendo
    // accionar lo que tenga al lado, que es lo que significa estar atado.
    return yours.filter((id) => {
        const member = partyMembers.find(m => Number(m.id) === Number(id));
        return member ? canWalk(member).allowed : false;
    });
}

/**
 * Which terrain brush is selected, or null when not editing.
 * @type {string|null}
 */
let activeTerrainBrush = null;

/**
 * The brush palette shown under a board while terrain editing is on.
 * @param {any} board
 * @param {() => void} onChange
 * @param {boolean} fogOn Si la niebla está puesta ahora (J12.13: en los grandes, sin decirlo, sí).
 * @returns {JQuery}
 */
function buildTerrainPalette(board, onChange, fogOn) {
    const palette = $('<div class="wm-terrain-palette"></div>');

    const chips = {
        floor: '#3a3a46',
        wall: '#2b2b33',
        difficult: '#b47828',
        cover_half: '#5aa0dc',
        cover_three_quarters: '#3a80bc',
        door: '#6b4a24',
    };

    for (const [value, label] of getTerrainOptions()) {
        const swatch = $('<div class="wm-terrain-swatch"></div>')
            .toggleClass('active', activeTerrainBrush === value);
        swatch.append($('<span class="swatch-chip"></span>').css('background', chips[value] || '#555'));
        swatch.append($('<span></span>').text(label));
        swatch.on('click', () => {
            activeTerrainBrush = activeTerrainBrush === value ? null : value;
            onChange();
        });
        palette.append(swatch);
    }

    const fogToggle = $('<div class="wm-terrain-swatch"></div>')
        .toggleClass('active', fogOn);
    fogToggle.append('<i class="fa-solid fa-cloud"></i>');
    fogToggle.append($('<span></span>').text('Niebla'));
    fogToggle.on('click', () => {
        board.fogEnabled = !fogOn;
        if (!board.fogEnabled) board.fog = createEmptyFog();
        persistBoardTerrain(board);
        onChange();
    });
    palette.append(fogToggle);

    const done = $('<div class="wm-terrain-swatch"></div>');
    done.append('<i class="fa-solid fa-xmark"></i>');
    done.append($('<span></span>').text('Salir'));
    done.on('click', () => {
        activeTerrainBrush = null;
        terrainEditing = false;
        onChange();
    });
    palette.append(done);

    return palette;
}

/** Whether the terrain editor is open on the current board. */
let terrainEditing = false;

/**
 * Computes live highlight cells (movement range + attackable enemies) from a tentative drag position.
 * Used by world-map-renderer onTokenDragging callback during drag.
 * @param {number} tokenId
 * @param {number} tentGX
 * @param {number} tentGY
 * @param {number} gridW
 * @param {number} gridH
 * @returns {import('../world-map-renderer.js').HighlightCell[]}
 */
function buildDragHighlightCells(tokenId, tentGX, tentGY, gridW, gridH) {
    // Tanda 10: arrastrando al colocarse, las casillas de salida siguen encendidas.
    const placing = placementHighlight();
    if (placing) return placing.highlightedCells;
    if (!combatEncounter.active) return [];
    const member = partyMembers.find(m => m.id === tokenId);
    if (!member) return [];
    const originX = member.mapPosition?.gridX || 0;
    const originY = member.mapPosition?.gridY || 0;
    const distanceFeet = getDistanceInFeet(originX, originY, tentGX, tentGY);
    const remainingFromHere = Math.max(0, getRemainingMovementFeet(member) - distanceFeet);
    const moveCells = getReachableCells(getActiveBoardTerrain(), tentGX, tentGY, remainingFromHere, gridW, gridH, { occupied: occupiedCellsFor(member) });
    const rangeFeet = getAttackRangeFeet(member);
    /** @type {{gridX:number,gridY:number,kind:'attack'}[]} */
    const attackCells = getAliveEnemies()
        .filter(e => getDistanceInFeet(tentGX, tentGY, e.gridX || 0, e.gridY || 0) <= rangeFeet)
        .map(e => ({ gridX: e.gridX || 0, gridY: e.gridY || 0, kind: /** @type {'attack'} */ ('attack') }));
    return [...moveCells, ...attackCells];
}

/** The mounted panel, when the board is on screen. Null when it is not. */
export let combatLogPanel = null;

/** Idea 20: el filtro del registro. Vive aquí, porque el panel se repinta entero. */
export let combatLogFilter = { kind: 'all', who: '' };

/**
 * K3: qué ficha centrar en el tablero: la de quien tiene el turno en combate, una vez por turno.
 *
 * @returns {{focusTokenId?: any, focusKey?: string}}
 */
function activeFocus() {
    if (!combatEncounter.active) return {};
    const entry = getCurrentTurnEntry();
    if (!entry || entry.isEnemy) return {};
    return { focusTokenId: getPartyMemberByTurnEntry(entry)?.id ?? null, focusKey: `${Number(combatEncounter.round) || 1}:${String(entry.id)}` };
}

/**
 * Los que el grupo ve esperando en el tablero abierto, tal y como los dibujó el último
 * repintado (con niebla y salas ya contadas). Tanda 10: con alguno, la pelea se abre sola
 * (`fight-entry.js`); antes salía de aquí la ficha de «Iniciar combate».
 *
 * @type {{board: string, placements: Array<{name: string, x: number, y: number}>}}
 */
export let lastWaiting = { board: '', placements: [] };

/**
 * La tarjeta de objetivo: lo que sale al pulsar un enemigo.
 *
 * La regla de toda la capa de clics: **un clic nunca gasta nada, un boton si**. Atacar
 * es irreversible y consume la accion del turno, asi que pulsar al enemigo solo abre
 * esto. Y cuando algo no se puede hacer, la tarjeta dice por que en vez de no responder.
 *
 * @param {any} member Quien actua.
 * @param {any} enemy
 */
function openTargetCard(member, enemy) {
    closeTargetCard();

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const distanceFeet = getDistanceInFeet(
        origin.gridX || 0, origin.gridY || 0, enemy.gridX || 0, enemy.gridY || 0,
    );
    const { ac, cover } = getTargetArmorClass(enemy, member);

    // Idea 2: lo que va a pasar si ataca, con las mismas cuentas que la tirada.
    const forecastRange = getAttackRangeFeet(member);
    const forecastEdge = attackEdge({
        targetId: String(enemy.instanceId),
        height: heightFor(partyCell(member), { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }),
        targetConditions: enemy.activeConditions ?? [],
        attackerConditions: member.activeConditions ?? [],
        distanceFeet,
        maneuvers: combatEncounter.maneuvers,
        byParty: true,
        flanked: partyFlanks(member, enemy),
        attackerId: String(member.id),
        hindered: attackHindrance(partyCell(member), { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 }, distanceFeet),
        grappledBy: String(/** @type {any} */ (member).grappledBy ?? ''),
    });
    // E3.1: Molestar (la maestría) también cuenta aquí, como en el golpe de verdad.
    const vexedNow = hasVex(combatEncounter.tactics, { by: String(member.id), target: String(enemy.instanceId), round: Number(combatEncounter.round) || 1 });
    const shownEdge = combineEdge(forecastEdge, vexedNow ? ['le tienes molestado'] : []);
    // E3.1: y el furtivo del pícaro, si este golpe lo lleva.
    const sneakNow = sneakFor(member, weaponOf(member), enemy, shownEdge);
    // El número que suma al d20, por partes: la característica, la competencia y lo demás.
    const attackParts = getPlayerAttackParts(member, forecastRange, [
        { label: 'del arma', value: weaponBonus(member) },
        { label: 'contra los de su clase', value: traitBonus(member, enemy.name) },
        { label: 'de lo aprendido', value: perkBonus(member, 'attack') },
    ]);
    const forecast = describeForecast({
        attackMod: attackParts.total,
        armorClass: ac,
        mode: shownEdge.mode,
        reasons: shownEdge.reasons,
        formula: getPlayerDamageFormula(member, forecastRange),
        damageBonus: Math.max(0, getPlayerAttackModifier(member, forecastRange)),
        targetHp: Number(enemy.currentHp) || 0,
    });
    const intent = planFor(enemy);
    const intentTarget = partyMembers.find(m => String(m.id) === String(intent.targetId ?? intent.focusId ?? ''));

    // Las que este personaje se sabe y van sobre un enemigo, cada una con su veredicto:
    // un conjuro de 120 ft no esta "fuera de alcance" porque la espada llegue a 5.
    // J19: con sus conjuros de 5e, si lanza con espacios.
    const usable = knownAbilitiesOf(member)
        .filter(ability => ability.target === 'enemy' && ability.combat !== false)
        .map(ability => {
            const verdict = canUseAbility({
                member,
                ability,
                distanceFeet,
                hasAction: hasAction(combatEncounter, 'action'),
                hasBonus: hasAction(combatEncounter, 'bonus'),
                targetAlive: (Number(enemy.currentHp) || 0) > 0,
                carried: carriedNames(),
            });
            const left = usesLeft(member, ability);
            return {
                id: ability.id,
                label: Number.isFinite(left) ? `${ability.name} (${left})` : ability.name,
                enabled: verdict.ok,
                reason: verdict.ok ? describeAbility(ability) : verdict.reason,
            };
        });

    const card = buildTargetCard({
        actor: member,
        target: enemy,
        distanceFeet,
        rangeFeet: getAttackRangeFeet(member),
        cover,
        abilities: usable,
        hasAction: hasAction(combatEncounter, 'action'),
        canUltimate: Boolean(planUltimate({
            bonds: getCampaignBonds(),
            party: partyMembers,
            actorId: String(member.id),
            targetId: String(enemy.instanceId),
        })),
    });

    const root = $('<div class="tc-card"></div>');
    // Su cara, la misma que en el tablero: su dibujo en pixel si no trae una propia.
    const face = faceFor({ isEnemy: true, name: String(enemy.name), avatar: String(enemy.avatar ?? ''), archetype: enemyArchetype(enemy) });
    const nameRow = $('<div class="tc-name"></div>');
    if (face) nameRow.append($('<img class="tc-face" alt="">').attr('src', face).toggleClass('pixel-art', face !== enemy.avatar));
    root.append(nameRow.append($('<span></span>').text(card.name)));
    root.append($('<div class="tc-stats"></div>').text(describeTargetCard(card)));
    if (card.inRange) root.append($('<div class="tc-forecast"></div>').text(forecast.text));
    // E2.1: la luz, dicha claro: quién ve a quién.
    const lightLine = lightCardLine(partyCell(member), { x: Number(enemy.gridX) || 0, y: Number(enemy.gridY) || 0 });
    if (lightLine) root.append($('<div class="tc-light"></div>').text(lightLine));
    // E3.1: «Furtivo +2d6: está en el suelo».
    if (card.inRange && sneakNow.ok) root.append($('<div class="tc-sneak"></div>').text(`${sneakBadge(sneakNow)}: ${sneakNow.why}`));
    // De dónde sale el número del ataque: «+5 al ataque: +3 de Fuerza y +2 de competencia».
    if (card.inRange) root.append($('<div class="tc-bonus"></div>').text(describeAttackBonus(attackParts)));
    if (intentTarget) root.append($('<div class="tc-intent"></div>').text(`Va a por ${intentTarget.name}.`));
    // R3: lo que alcanzaría cada habilidad de área, antes de usarla. Colocarse importa.
    for (const ability of knownAbilitiesOf(member).filter(a => a.target === 'enemy' && isArea(a.area))) {
        const { victims } = abilityVictims(member, 'party', ability, enemy);
        const own = victims.filter(v => v.kind === 'party');
        root.append($('<div class="tc-area"></div>').toggleClass('tc-area-risk', own.length > 0).text(
            `${ability.name} alcanzaría a ${victims.map(v => v.ref.name).join(', ') || 'nadie'}${own.length > 0 ? ` (¡${own.length === 1 ? 'uno es de los tuyos' : `${own.length} son de los tuyos`}!)` : ''}.`,
        ));
    }

    const bar = $('<div class="tc-hp"></div>');
    const pct = card.maxHp > 0 ? Math.round((card.hp / card.maxHp) * 100) : 0;
    bar.append($('<div class="tc-hp-fill"></div>').css('width', `${pct}%`));
    root.append(bar);

    const actions = $('<div class="tc-actions"></div>');
    for (const action of card.actions) {
        // E3.4: el golpe definitivo, con su nombre («La carga del Mellado»).
        const label = action.id === 'ultimate' && action.enabled ? ultimateOf(member).name : action.label;
        const button = $('<button class="menu_button tc-btn" type="button"></button>').text(label);
        button.prop('disabled', !action.enabled);
        if (!action.enabled) button.attr('title', action.reason);
        button.on('click', () => {
            closeTargetCard();
            if (action.id === 'attack') {
                handlePlayerCombatAttack(enemy.name);
            } else if (action.id.startsWith('ability:')) {
                const ability = getAbilityCatalogue().find(a => a.id === action.id.slice('ability:'.length));
                if (ability) useAbility(member, ability, enemy);
            } else {
                resolveUltimateStrike(enemy.name);
            }
        });
        actions.append(button);
    }

    // R3: a una con quien tiene vínculo, si los dos están pegados a este enemigo.
    const heroId = String(partyMembers[0]?.id ?? '');
    const bonds = getCampaignBonds();
    const fighters = partyMembers.filter(m => !m.dead).map(m => ({
        id: String(m.id), name: String(m.name), ...boardCellOf(m), hp: Number(m.hp) || 0,
        rank: getBondProgress(bonds, String(m.id)).rank, reactionUsed: usedReactions.has(`party:${m.id}`),
    }));
    const me = fighters.find(f => f.id === String(member.id));
    const pairs = me && hasAction(combatEncounter, 'action')
        ? pairOptions({ actor: me, heroId, party: fighters, enemies: [{ id: String(enemy.instanceId), name: String(enemy.name), ...boardCellOf(enemy), hp: Number(enemy.currentHp) || 0 }] })
        : [];
    for (const pair of pairs) {
        const button = $('<button class="menu_button tc-btn tc-pair" type="button"></button>').text(`A una con ${pair.partnerName}`);
        button.attr('title', 'Los dos atacáis, con ventaja. Gasta tu acción y su reacción.');
        button.on('click', () => {
            closeTargetCard();
            resolvePairStrike(member, pair.partnerId, enemy);
        });
        actions.append(button);
    }
    // E3.4: la jugada propia del rango 7, con su nombre.
    for (const move of bondChoices(member, enemy).filter(c => c.kind === 'pair_move')) {
        const button = $('<button class="menu_button tc-btn tc-pair tc-bond-move" type="button"></button>')
            .attr('data-bond-move', move.companionId).text(move.name);
        button.attr('title', move.desc);
        button.on('click', () => {
            closeTargetCard();
            resolveBondMove(member, move.companionId, move.enemyId);
            renderLocationMapsPreview();
        });
        actions.append(button);
    }

    // R5: la mascota, una vez por ronda, sin gastar la acción de nadie.
    const pet = currentPet();
    if (pet && Number(/** @type {any} */ (combatEncounter).petRound) !== (Number(combatEncounter.round) || 1)) {
        for (const help of supportActions(pet)) {
            const button = $('<button class="menu_button tc-btn tc-pet" type="button"></button>').attr('data-pet', help.id).text(`${pet.name}: ${help.label.toLowerCase()}`);
            button.attr('title', help.note);
            button.on('click', () => {
                closeTargetCard();
                petSupport(help.id, enemy);
            });
            actions.append(button);
        }
    }

    const close = $('<button class="menu_button tc-btn tc-close" type="button"></button>').text('Cerrar');
    close.on('click', () => closeTargetCard());
    actions.append(close);
    root.append(actions);

    // Lo que impide actuar se dice, no se deja adivinar. Escrito, no en el aviso de pasar el
    // ratón por encima del botón: con el dedo, ese aviso no sale nunca (J20.2).
    const blocked = [...new Set(card.actions.filter(a => !a.enabled).map(a => String(a.reason || '')).filter(Boolean))];
    for (const reason of blocked.slice(0, 3)) {
        root.append($('<div class="tc-why"></div>').text(reason));
    }

    $('body').append($('<div class="tc-overlay"></div>').on('click', () => closeTargetCard()).append(root));
}

/** Cierra la tarjeta, si hay alguna. */
function closeTargetCard() {
    $('.tc-overlay').remove();
}

/**
 * La cara de alguien del combate para la fila de iniciativa y las tarjetas: la suya si la
 * trae; si no, su dibujo en pixel (el bicho del enemigo, el retrato de relleno del héroe), el
 * mismo que en su ficha del tablero. Vacío si no hay ninguna.
 *
 * @param {Partial<import('../world-map-renderer.js').TokenData>} who
 * @returns {string}
 */
function faceFor(who) {
    const drawn = tokenArt(who);
    if (drawn) return drawn;
    return isPlainFace(who.avatar) ? '' : String(who.avatar);
}

/**
 * El arquetipo de un enemigo del combate, por su plantilla del mundo.
 *
 * @param {any} enemy
 * @returns {string}
 */
function enemyArchetype(enemy) {
    return archetypeOf(enemy?.archetype ? enemy : getCurrentWorldEnemies().find(t => String(t.id) === String(enemy?.templateId)));
}

/**
 * La cara de una fila de la iniciativa: la del enemigo o la del personaje que es.
 *
 * @param {{id: string, isEnemy: boolean, name: string, avatar: string}} entry
 * @returns {string}
 */
function initiativeFace(entry) {
    if (entry.isEnemy) {
        const enemy = combatEncounter.enemies.find(e => String(e.instanceId) === String(entry.id));
        return faceFor({ isEnemy: true, name: entry.name, avatar: String(enemy?.avatar ?? entry.avatar ?? ''), archetype: enemyArchetype(enemy) });
    }
    const member = partyMembers.find(m => String(m.id) === String(entry.id));
    // J19.5: una invocación, su bicho, como en el tablero.
    const summon = member ? null : /** @type {any} */ (getPartyMemberByTurnEntry(/** @type {any} */ (entry)));
    if (summon?.summon) return faceFor({ isSummon: true, name: entry.name, avatar: '', archetype: String(summon.archetype ?? '') });
    return faceFor({
        name: entry.name, avatar: String(member?.avatar ?? entry.avatar ?? ''),
        className: member?.class, gender: member?.gender, race: member?.race,
    });
}

/**
 * La ruta hasta una casilla y lo que cuesta llegar, para ensenarla antes de pulsar.
 *
 * La calcula el mismo A* que usa la IA enemiga: una linea dibujada a ojo diria una cosa y
 * el movimiento haria otra, que es peor que no dibujar nada.
 *
 * @param {number} gridX
 * @param {number} gridY
 * @returns {{cells: Array<{gridX: number, gridY: number}>, feet: number, ok: boolean, provokes: string[]}|null}
 */
function previewMovement(gridX, gridY) {
    // Tanda 10: mientras se coloca al grupo no hay ruta que enseñar: se pone, no se anda.
    if (placingNow()) return null;
    // Fuera de combate, la ficha elegida: el mismo camino que andará (sin tope de pies).
    const walker = combatEncounter.active ? null : selectedWalker();
    if (walker) {
        const { terrain, gridWidth: w, gridHeight: h } = getActiveBoardContext();
        const origin = walker.mapPosition || { gridX: 0, gridY: 0 };
        const occupied = walkBlockers(walker);
        const path = findPath(terrain, origin.gridX || 0, origin.gridY || 0, gridX, gridY, w, h, { occupied });
        if (!path || path.length === 0) return null;
        const feet = getPathCost(terrain, path) * 5;
        return { cells: path.slice(1).map(cell => ({ gridX: cell.x, gridY: cell.y })), feet, ok: true, provokes: [] };
    }
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !member) return null;

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const { terrain, gridWidth: w, gridHeight: h } = getActiveBoardContext();
    const path = findPath(terrain, origin.gridX || 0, origin.gridY || 0, gridX, gridY, w, h, {
        // Las casillas ocupadas no se atraviesan, igual que al mover de verdad; ni las trampas vistas.
        occupied: new Set([...occupiedCellsFor(member), ...knownTrapsHere()]),
    });
    if (!path || path.length === 0) return null;

    const feet = getPathCost(terrain, path) * 5;
    // Idea 1: quien te golpearia al salir de su alcance, con la misma cuenta que el golpe.
    const disengaged = readManeuvers(combatEncounter.maneuvers).disengaged.includes(String(member.id));
    const provokes = disengaged ? [] : findOpportunityAttacks({
        mover: member,
        from: { x: origin.gridX || 0, y: origin.gridY || 0 },
        to: { x: gridX, y: gridY },
        threats: getAliveEnemies(),
        reachOf: (/** @type {any} */ enemy) => Number(enemy?.attackRangeFeet) || 5,
        isAlive: (/** @type {any} */ enemy) => (Number(enemy?.currentHp) || 0) > 0,
        canReact: (/** @type {any} */ enemy) => !usedReactions.has(String(enemy.instanceId)),
    }).map(attack => String(attack.threat.name));
    return {
        cells: path.slice(1).map(cell => ({ gridX: cell.x, gridY: cell.y })),
        feet,
        ok: feet <= getRemainingMovementFeet(member),
        provokes,
    };
}

/**
 * Pulsar una casilla encendida.
 *
 * Solo las encendidas llegan aqui: el renderizador no deja pulsar las demas. Mover es
 * reversible dentro del turno, asi que un clic basta; atacar no, y por eso una casilla
 * de ataque abre la tarjeta en vez de resolver el golpe.
 *
 * @param {number} gridX
 * @param {number} gridY
 * @param {string} kind
 */
function handleBoardCellClick(gridX, gridY, kind) {
    // Tanda 10: colocándose antes de la pelea, el clic coloca (o elige a quien está ahí).
    if (placementCellClick(gridX, gridY)) return;
    // Fuera de combate: la ficha elegida anda hasta ahí, por la misma puerta que al arrastrarla
    // (hace falta camino), y sigue elegida para el paso siguiente.
    const walker = combatEncounter.active ? null : selectedWalker();
    // J12.4: con quien abre el grupo elegido, un clic lleva al grupo entero (los demás le siguen
    // y se ponen detrás, `group-move.js`); con otro elegido, solo anda ese, para colocarlo.
    const lead = partyMembers.find(m => !m.dead) ?? null;
    const followers = partyMembers.some(m => m !== lead && !m.dead
        && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName));
    if (walker && walker === lead && followers) {
        groupMoveTo(gridX, gridY);
        return;
    }
    if (walker) {
        handleTokenMove(walker.id, gridX, gridY, currentLocationName);
        renderLocationMapsPreview();
        return;
    }
    const member = getCurrentActingMember();
    if (!member) return;

    if (kind === 'attack') {
        const enemy = getAliveEnemies().find(e => (e.gridX || 0) === gridX && (e.gridY || 0) === gridY);
        if (enemy) openTargetCard(member, enemy);
        return;
    }

    // `/combat-move` habla en las coordenadas que el tablero dibuja en sus ejes, que
    // empiezan en 1; el renderizador cuenta desde 0. Sin el +1 el clic movia a la
    // casilla de arriba a la izquierda de la pulsada, y el recorrido lo cazo.
    handlePlayerCombatMove(`${gridX + 1} ${gridY + 1}`);
}

/**
 * @param {number} tokenId
 */
function handleCombatTokenClick(tokenId) {
    // Tanda 10: colocándose antes de la pelea, pulsar a uno de los tuyos lo elige para colocarlo.
    if (placementTokenClick(tokenId)) return;
    // Fuera de combate, pulsar una ficha tuya la elige (y otra vez, la suelta): se encienden
    // las casillas a las que puede ir.
    if (!combatEncounter.active) {
        if (!currentBoardName || tokenId < 0 || !getControlledMemberIds().some(own => Number(own) === Number(tokenId))) return;
        const chosen = combatBoardSelection.tokenId === tokenId
            && combatBoardSelection.boardName === currentBoardName
            && combatBoardSelection.locationName === currentLocationName;
        setCombatBoardSelection(chosen
            ? { tokenId: null, boardName: '', locationName: '' }
            : { tokenId, boardName: currentBoardName, locationName: currentLocationName });
        renderLocationMapsPreview();
        return;
    }
    const entry = getCurrentTurnEntry();
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !entry || entry.isEnemy || !member) return;

    // Las fichas de enemigo llevan id negativo. Pulsar una abre su tarjeta: **un clic
    // nunca gasta nada**, y atacar es el boton de la tarjeta.
    if (tokenId < 0) {
        const enemy = combatEncounter.enemies[-tokenId - 1];
        if (enemy && (enemy.currentHp || 0) > 0) openTargetCard(member, enemy);
        return;
    }

    if (tokenId !== member.id) return;

    const alreadySelected = combatBoardSelection.tokenId === tokenId
        && combatBoardSelection.boardName === currentBoardName
        && combatBoardSelection.locationName === currentLocationName;

    setCombatBoardSelection(alreadySelected
        ? { tokenId: null, boardName: '', locationName: '' }
        : { tokenId, boardName: currentBoardName, locationName: currentLocationName });

    renderLocationMapsPreview();
}

export function renderWorldMapPreview() {
    const container = $('#world_map_preview');
    if (!container.length) return;

    const mapUrl = getCurrentWorldMapUrl();
    const locationMaps = getCurrentWorldLocationMaps();

    renderWorldMapView(container, mapUrl, locationMaps, {
        onLocationSelect: (loc) => {
            setCurrentLocationName(loc.name);
            saveCurrentLocation();
        },
        onLocationNavigate: (loc) => {
            // Switch to Location tab
            setCurrentLocationName(loc.name);
            saveCurrentLocation();
            $('#rm_tab_location').trigger('click');
        },
    });
}

/**
 * Build the combat encounter UI section (banner, turn order, enemy cards, buttons).
 * @param {Object} board - The current board object
 * @returns {JQuery}
 */
/**
 * @param {{ name: string }} board
 */
function buildCombatSection(board) {
    const section = $('<div class="wm-combat-section"></div>');
    const currentEntry = getCurrentTurnEntry();
    const currentMember = getCurrentActingMember();
    const turnState = getCurrentTurnState();

    // Banner
    section.append(`<div class="wm-combat-banner"><i class="fa-solid fa-swords"></i> En combate — ${escapeHtml(board.name)}</div>`);

    // ---- Scenario objectives (wiki/ROADMAP.md, Fase E) ----
    // Above the initiative order, because what the fight is *for* outranks whose turn it
    // is. Only drawn when the board actually carries a scenario.
    const scenario = judgeCurrentScenario();
    if (scenario && scenario.rows.length > 0) {
        const panel = $('<div class="wm-objectives"></div>');
        panel.append($('<div class="wm-objectives-title"></div>').text('Objetivos'));

        for (const row of scenario.rows) {
            const line = $('<div class="wm-objective"></div>').addClass(`status-${row.status}`);
            line.append($('<i class="wm-objective-icon fa-solid"></i>').addClass(
                row.status === 'complete' ? 'fa-circle-check'
                    : row.status === 'failed' ? 'fa-circle-xmark' : 'fa-circle',
            ));
            line.append($('<span class="wm-objective-label"></span>').text(row.label));
            if (row.optional) {
                line.append($('<span class="wm-objective-optional"></span>').text('opcional'));
            }
            panel.append(line);
        }

        section.append(panel);
    }

    // ---- Initiative tracker (wiki/ROADMAP.md, B8) ----
    // Replaces the numbered list of names that used to live here. The list said who was
    // in the fight and nothing else, so knowing whether the wounded one acts before the
    // ghoul meant counting rows by hand every round.
    const tracker = buildTracker({
        turnOrder: combatEncounter.turnOrder,
        currentTurnIndex: combatEncounter.currentTurnIndex,
        round: combatEncounter.round,
        // J19.5: las invocaciones tienen su fila, con su vida y lo que llevan encima.
        party: [...partyMembers, ...activeSummons()],
        enemies: combatEncounter.enemies,
    });

    if (tracker.entries.length > 0) {
        const panel = $('<div class="wm-init"></div>');

        const head = $('<div class="wm-init-head"></div>');
        head.append($('<span class="wm-init-round"></span>').text(`Ronda ${tracker.round}`));
        head.append($('<span class="wm-init-turn"></span>').text(describeTurn(tracker)));
        panel.append(head);

        const list = $('<div class="wm-init-list"></div>');
        for (const entry of tracker.entries) {
            const row = $('<div class="wm-init-row"></div>')
                .toggleClass('current', entry.isCurrent)
                .toggleClass('next', entry.isNext)
                .toggleClass('enemy', entry.isEnemy)
                .toggleClass('defeated', entry.defeated)
                .toggleClass('bloodied', entry.bloodied);

            row.append($('<span class="wm-init-score"></span>').text(String(entry.initiative)));
            // Idea 5: la cara, o la inicial si no la tiene. Se reconoce antes que un nombre.
            // Sin cara propia, su dibujo en pixel: el bicho o el retrato de su clase.
            const face = initiativeFace(entry);
            row.append(face
                ? $('<img class="wm-init-face" alt="">').attr('src', face).toggleClass('pixel-art', face !== entry.avatar)
                : $('<span class="wm-init-face wm-init-initial"></span>').text(entry.name.charAt(0).toUpperCase()));

            const body = $('<div class="wm-init-body"></div>');
            const nameLine = $('<div class="wm-init-name-line"></div>');
            nameLine.append($('<span class="wm-init-name"></span>').text(entry.name));

            // Conditions as icons rather than as a sentence: a row you can read at a
            // glance is the whole point of a tracker.
            for (const status of entry.statuses) {
                nameLine.append(
                    $('<i class="wm-init-status fa-solid"></i>')
                        .addClass(status.icon)
                        .attr('title', status.label),
                );
            }
            body.append(nameLine);
            // J20.2: en una pantalla táctil los iconos no dicen nada sin ratón encima: sus nombres,
            // escritos (el CSS solo los enseña donde no se puede pasar el ratón).
            if (entry.statuses.length > 0) {
                body.append($('<div class="wm-init-status-text"></div>').text(entry.statuses.map(s => String(s.label)).join(' · ')));
            }

            if (entry.maxHp > 0) {
                body.append($('<div class="wm-init-hp"></div>').append(
                    $('<div class="wm-init-hp-fill"></div>').css('width', `${entry.hpPct}%`),
                ));
                body.append($('<span class="wm-init-hp-text"></span>')
                    .text(`${entry.hp}/${entry.maxHp}`));
            }

            row.append(body);
            list.append(row);
        }

        panel.append(list);
        section.append(panel);
    }


    // Enemy cards
    if (combatEncounter.enemies.length > 0) {
        const enemyGrid = $('<div class="wm-combat-enemy-grid"></div>');
        for (const enemy of combatEncounter.enemies) {
            const hpPct = enemy.maxHp > 0 ? Math.min(100, (enemy.currentHp / enemy.maxHp) * 100) : 0;
            const isDead = enemy.currentHp <= 0;
            // Su dibujo, el mismo que en el tablero; la calavera, solo si no hay ninguno.
            const face = faceFor({ isEnemy: true, name: String(enemy.name), avatar: String(enemy.avatar ?? ''), archetype: enemyArchetype(enemy) });
            const avatarHtml = face
                ? `<img src="${escapeHtml(face)}" alt=""${face !== enemy.avatar ? ' class="pixel-art" data-pixel="true"' : ''} />`
                : '<i class="fa-solid fa-skull fa-2x"></i>';
            enemyGrid.append(`
                <div class="wm-combat-enemy-card${isDead ? ' wm-combat-enemy-dead' : ''}">
                    <div class="wm-combat-enemy-avatar">${avatarHtml}</div>
                    <div class="wm-combat-enemy-info">
                        <div class="wm-combat-enemy-name">${escapeHtml(enemy.name)}</div>
                        <div class="wm-combat-enemy-stats">
                            <span>PG ${enemy.currentHp}/${enemy.maxHp}</span>
                            <span>CA ${enemy.armorClass}</span>
                            <span>Desafío ${({ 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' })[Number(enemy.cr)] ?? enemy.cr}</span>
                        </div>
                        <div class="wm-combat-enemy-hp-bar">
                            <div class="wm-combat-enemy-hp-fill" style="width:${hpPct}%"></div>
                        </div>
                    </div>
                </div>
            `);
        }
        section.append('<div class="wm-combat-enemies-title">Enemigos</div>');
        section.append(enemyGrid);
    }

    if (currentEntry && !currentEntry.isEnemy && currentMember && turnState) {
        const remainingFeet = getRemainingMovementFeet(currentMember);
        const rangeFeet = getAttackRangeFeet(currentMember);
        const targets = getAttackableEnemiesForMember(currentMember);
        const memberX = Number.isFinite(Number(currentMember.mapPosition?.gridX)) ? Number(currentMember.mapPosition?.gridX) : 0;
        const memberY = Number.isFinite(Number(currentMember.mapPosition?.gridY)) ? Number(currentMember.mapPosition?.gridY) : 0;
        const nearestEnemyInfo = getAliveEnemies()
            .map(enemy => ({
                name: enemy.name,
                distanceFeet: getDistanceInFeet(memberX, memberY, Number(enemy.gridX) || 0, Number(enemy.gridY) || 0),
            }))
            .sort((a, b) => a.distanceFeet - b.distanceFeet)[0] || null;
        const targetChips = targets.length
            ? targets.map(enemy => `<span class="wm-combat-chip attack">${escapeHtml(enemy.name)} · ${getDistanceInFeet(memberX, memberY, Number(enemy.gridX) || 0, Number(enemy.gridY) || 0)} pies</span>`).join('')
            : `<span class="wm-combat-chip attack">Nadie al alcance${nearestEnemyInfo ? ` · el más cercano: ${escapeHtml(nearestEnemyInfo.name)} (${nearestEnemyInfo.distanceFeet} pies)` : ''}</span>`;
        // Lo gastado y lo que queda, dicho como se diría en la mesa.
        const spent = (/** @type {boolean} */ used) => (used ? 'gastada' : 'libre');

        section.append(`
            <div class="wm-combat-turn-panel">
                <strong>${escapeHtml(currentMember.name)}</strong> · Te toca<br>
                <div class="wm-combat-turn-help">Acción: ${spent(turnState.actionUsed)} · Adicional: ${spent(turnState.bonusActionUsed)} · Reacción: ${spent(turnState.reactionUsed)} · Te quedan ${remainingFeet} pies de movimiento · Alcance: ${rangeFeet} pies.</div>
                <div class="wm-combat-chip-row">
                    <span class="wm-combat-chip move">Pulsa tu ficha para ver hasta dónde puedes andar</span>
                    ${targetChips}
                </div>
                <div class="wm-combat-button-note">Con comandos: /combat-attack &lt;objetivo&gt;, /combat-move &lt;x&gt; &lt;y&gt;, /combat-end</div>
            </div>
        `);
    }

    // J7.3 y D-J32: quién mueve a las invocaciones y a los compañeros que ya son amigos. Un
    // botón por cada uno, que pasa de «Lo muevo yo» a «Que lo lleve el juego» y vuelta.
    const choices = controlChoices();
    if (choices.length > 0) {
        const controlRow = $('<div class="wm-combat-control"></div>');
        controlRow.append($('<span class="wm-combat-control-title"></span>').text('Quién le mueve'));
        for (const choice of choices) {
            const next = choice.control === 'player' ? 'engine' : 'player';
            const button = $('<button class="menu_button wm-combat-control-btn" type="button"></button>')
                .attr('data-control-id', choice.id)
                .attr('data-control', choice.control)
                .attr('title', `Pulsa para cambiarlo a «${CONTROL_LABELS[next]}»`)
                .text(`${choice.summon ? '🐾 ' : ''}${choice.name}: ${CONTROL_LABELS[choice.control]}`);
            button.on('click', () => { chooseControlOf(choice.id, next); });
            controlRow.append(button);
        }
        section.append(controlRow);
    }

    // Action buttons
    const btnRow = $('<div class="wm-combat-buttons"></div>');
    const endTurnBtn = $('<button class="menu_button"><i class="fa-solid fa-forward-step"></i> Fin de turno</button>');
    endTurnBtn.on('click', () => {
        const nextEntry = endPlayerCombatTurn();
        if (nextEntry) {
            toastr.info(`🎯 Turno de ${nextEntry}`);
        }
    });
    btnRow.append(endTurnBtn);
    section.append(btnRow);

    return section;
}

// ---- Tanda 10: el tablero como una mesa virtual (wiki/maquetas/ENCARGO_COMBATE_VTT.md) ----
// Dentro del Modo Juego el tablero ocupa toda la pantalla de juego y lo de alrededor flota encima,
// en islas: arriba a la derecha la iniciativa y el resumen del combate (que sustituye a la franja
// del registro de abajo); arriba a la izquierda, volver y el sitio; abajo a la izquierda, la cámara
// y el minimapa (world-map-renderer.js). Fuera del Modo Juego (el cajón de SillyTavern), lo de antes.

/**
 * La ficha del tablero de una fila de la iniciativa: la de un enemigo (id negativo, por su sitio
 * en el combate, como la dibuja `buildEnemyTokens`), la de uno del grupo o la de una invocación.
 *
 * @param {any} entry
 * @returns {number|null}
 */
function tokenIdOfEntry(entry) {
    if (!entry) return null;
    if (entry.isEnemy) {
        const index = combatEncounter.enemies.findIndex(e => String(e.instanceId) === String(entry.id));
        return index >= 0 ? -(index + 1) : null;
    }
    const member = /** @type {any} */ (getPartyMemberByTurnEntry(entry));
    return member ? Number(member.id) : null;
}

/**
 * Las casillas a las que llega en tu turno una ficha tuya, con lo que te queda de movimiento,
 * para encenderlas al pasar el ratón por encima. Nada si no es tuya o no le toca, y nada fuera
 * de combate: ahí se anda libre, sin tope de pies, y encender el tablero entero no dice nada.
 *
 * @param {number|string} tokenId
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{gridX: number, gridY: number}>|null}
 */
function reachOfToken(tokenId, gridWidth, gridHeight) {
    if (!combatEncounter.active) return null;
    const entry = getCurrentTurnEntry();
    const member = /** @type {any} */ (getCurrentActingMember());
    if (!entry || entry.isEnemy || !member || String(member.id) !== String(tokenId)) return null;
    const occupied = new Set([...occupiedCellsFor(member), ...knownTrapsHere()]);
    const x = Number(member.mapPosition?.gridX) || 0;
    const y = Number(member.mapPosition?.gridY) || 0;
    return getReachableCells(getActiveBoardTerrain(), x, y, getRemainingMovementFeet(member), gridWidth, gridHeight, { occupied })
        .filter(cell => cell.gridX !== x || cell.gridY !== y);
}

/**
 * Lo que necesita la mesa virtual del combate de ahora: quién tiene el turno (Espacio y la cámara
 * van a su ficha), qué turno es, y qué enemigos llevan marcador de borde si no se ven, con su
 * distancia en pies. Solo los que el grupo ve: un marcador no chiva a nadie tras la niebla.
 *
 * @param {Set<string>|null} visible Las casillas a la vista, con niebla; sin niebla, nada.
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {import('../world-map-renderer.js').VttOptions}
 */
function vttOptionsNow(visible, gridWidth, gridHeight) {
    const fighting = Boolean(combatEncounter.active);
    const entry = fighting ? getCurrentTurnEntry() : null;
    const acting = entry && !entry.isEnemy ? getCurrentActingMember() : null;
    // La distancia se cuenta desde quien juega su turno; en el de un enemigo, desde tu héroe.
    const from = acting ?? partyMembers.find(m => !m.dead && (Number(m.hp) || 0) > 0) ?? null;
    const fromX = Number(from?.mapPosition?.gridX) || 0;
    const fromY = Number(from?.mapPosition?.gridY) || 0;
    const edgeTargets = fighting
        ? getAliveEnemies()
            .filter(enemy => !visible || visible.has(cellKey(Number(enemy.gridX) || 0, Number(enemy.gridY) || 0)))
            .map(enemy => ({
                id: -(combatEncounter.enemies.indexOf(enemy) + 1),
                name: String(enemy.name),
                feet: from ? getDistanceInFeet(fromX, fromY, Number(enemy.gridX) || 0, Number(enemy.gridY) || 0) : undefined,
            }))
        : [];
    // Tanda 17: el cartel del turno. «Tu turno» si lo mueves tú (el héroe, o un compañero o una
    // invocación que llevas tú); si lo juega el juego, de quién es.
    const mine = Boolean(acting) && (String(acting?.id) === String(partyMembers[0]?.id)
        || underYourHand([Number(acting?.id)]).length > 0
        || controlChoices().some(choice => String(choice.id) === String(acting?.id) && choice.control === 'player'));
    /** @type {'yours'|'ally'|'enemy'} */
    const turnSide = entry?.isEnemy ? 'enemy' : mine ? 'yours' : 'ally';
    return {
        combat: fighting,
        activeTokenId: entry ? tokenIdOfEntry(entry) : null,
        turnKey: entry ? `${Number(combatEncounter.round) || 1}:${String(entry.id)}` : '',
        yours: Boolean(acting),
        edgeTargets,
        reachOf: (tokenId) => reachOfToken(tokenId, gridWidth, gridHeight),
        turnTitle: entry ? turnBannerText({ name: String(entry.name ?? ''), side: turnSide }) : '',
        turnSide,
    };
}

/**
 * Pone las islas de la mesa virtual: volver, arriba a la izquierda; y en combate, la iniciativa y
 * el resumen arriba a la derecha. El resumen es ahora el registro del combate (`combatLogPanel`).
 *
 * @param {import('../world-map-renderer.js').VttHandle} view
 * @param {JQuery} backBtn
 * @returns {JQuery} La fila de botones de arriba a la izquierda, donde va también el del terreno.
 */
function mountVttHud(view, backBtn) {
    const tools = $('<div class="vtt-tools vtt-island"></div>').append(backBtn);
    $(view.hud.topLeft).prepend(tools);
    if (!combatEncounter.active) return tools;

    const tracker = buildTracker({
        turnOrder: combatEncounter.turnOrder,
        currentTurnIndex: combatEncounter.currentTurnIndex,
        round: combatEncounter.round,
        // J19.5: las invocaciones tienen su fila, con su vida y lo que llevan encima.
        party: [...partyMembers, ...activeSummons()],
        enemies: combatEncounter.enemies,
    });
    if (tracker.entries.length > 0) {
        const scenario = judgeCurrentScenario();
        view.hud.topRight.appendChild(buildInitiative({
            tracker,
            faceOf: (entry) => initiativeFace(entry),
            onPick: (entry) => {
                const id = tokenIdOfEntry(entry);
                if (id !== null) view.centerOnToken(id, true);
            },
            youId: String(partyMembers[0]?.id ?? ''),
            controls: controlChoices(),
            controlLabels: CONTROL_LABELS,
            onControl: (id, next) => { chooseControlOf(id, next); },
            objectives: scenario?.rows ?? [],
        }));
    }

    const summary = $(buildSummary());
    view.hud.topRight.appendChild(summary[0]);
    combatLogPanel = summary;
    // Idea 20: de quién y de qué, como en el registro de antes.
    summary.attr('data-kind', combatLogFilter.kind).attr('data-who', combatLogFilter.who);
    const people = [...partyMembers.map(m => String(m.name)), ...combatEncounter.enemies.map((/** @type {any} */ e) => String(e.name))]
        .filter((name, index, all) => name && all.indexOf(name) === index);
    const repaint = () => {
        combatLogFilter = logFilterOf(summary);
        renderLogFilters(summary, people, repaint);
        paintCombatLog();
    };
    renderLogFilters(summary, people, repaint);
    paintCombatLog();
    setRound(summary, Number(combatEncounter.round) || 1);
    return tools;
}

/**
 * Volver a dibujar el tablero. Para las pruebas y las herramientas que cambian el terreno
 * desde fuera: el juego ya redibuja solo cuando algo suyo lo cambia.
 */
export function refreshBoardView() {
    renderLocationMapsPreview();
}

export function renderLocationMapsPreview() {
    // Tanda 17: mientras se enseña la secuencia de un golpe, el tablero se queda como estaba y la
    // secuencia lo va cambiando; se dibuja de verdad al acabar (`combat-fx.js`).
    if (holdRedraw(renderLocationMapsPreview)) return;
    drawLocationMapsPreview();
    // La caja de escribir dice lo del juego mientras no hay pelea (la pelea pone la suya). Al
    // cambiar de chat el mundo aún no está atado a una partida nueva: aquí ya lo está.
    if (!combatEncounter.active) restoreChatPlaceholder();
    // El Shell dibuja su cabecera y su barra a partir del mismo estado que acaba de
    // pintar el tablero, asi que se refresca aqui y no en cada sitio que redibuja.
    if (isShellOpen()) refreshGameShell();
}

function drawLocationMapsPreview() {
    const container = $('#world_location_maps_list');
    if (!container.length) return;

    container.empty();
    // The panel about to be discarded with the rest of the view. Re-mounted below if the
    // board is what gets drawn; anything else leaves the log without a place to render.
    combatLogPanel = null;

    const shell = $('<div class="wm-location-shell"></div>');
    const toolbar = $(`
        <div class="wm-location-toolbar">
            <div class="wm-location-toolbar-title"><i class="fa-solid fa-map-location-dot"></i> Mapas</div>
            <div class="wm-location-toolbar-actions">
                <button class="menu_button" data-location-toggle>${locationMapsManuallyHidden ? 'Abrir' : 'Ocultar'}</button>
            </div>
        </div>
    `);
    shell.append(toolbar);
    container.append(shell);

    toolbar.find('[data-location-toggle]').on('click', () => {
        setLocationMapsHidden(!locationMapsManuallyHidden);
        renderLocationMapsPreview();
    });

    if (locationMapsManuallyHidden) {
        shell.append('<div class="wm-location-collapsed">Los mapas quedan ocultos hasta que pulses «Abrir».</div>');
        return;
    }

    const contentRoot = $('<div class="wm-location-content"></div>');
    shell.append(contentRoot);

    const locationMaps = getCurrentWorldLocationMaps();
    if (!locationMaps || locationMaps.length === 0) {
        contentRoot.html('<div class="wm-empty-state">Este mundo aún no tiene ninguna localización con mapa.</div>');
        return;
    }

    // Find the current location
    let loc = locationMaps.find(l => l.name === currentLocationName);
    const resolvedBoards = getLocationBoards(loc);
    console.log('[party] renderLocationMapsPreview', { currentLocationName, currentBoardName, locName: loc?.name, locBoardsLength: resolvedBoards.length, resolvedBoards });

    // No location selected yet — show a chooser
    if (!loc) {
        let cards = '';
        for (const l of locationMaps) {
            const imgHtml = l.url
                ? `<img src="${escapeHtml(l.url)}" alt="" />`
                : '<i class="fa-solid fa-location-dot fa-2x"></i>';
            cards += `
            <div class="wm-loc-choose-card" data-loc="${escapeHtml(l.name)}">
                <div class="wm-loc-choose-img">${imgHtml}</div>
                <div class="wm-loc-choose-name">${escapeHtml(l.name)}</div>
                ${l.region ? `<div class="wm-loc-choose-region">${escapeHtml(l.region)}</div>` : ''}
            </div>`;
        }
        contentRoot.html(`
            <div class="wm-loc-chooser">
                <div class="wm-loc-chooser-title"><i class="fa-solid fa-compass"></i> ¿Dónde estáis?</div>
                <div class="wm-loc-choose-grid">${cards}</div>
            </div>
        `);
        contentRoot.find('.wm-loc-choose-card').on('click', function () {
            setCurrentLocationName(String($(this).data('loc')));
            setCurrentBoardName('');
            saveCurrentLocation();
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        return;
    }

    // Build view tabs (Location Name ↔ World)
    const viewTabs = $(`
        <div class="wm-view-tabs">
            <div class="wm-view-tab active" data-view="location"><i class="fa-solid fa-location-dot"></i> ${loc.name}</div>
            <div class="wm-view-tab" data-view="world"><i class="fa-solid fa-globe"></i> Mundo</div>
        </div>
    `);
    const locationPanel = $('<div class="wm-view-panel active" data-view="location" data-map-root></div>');
    const worldPanel = $('<div class="wm-view-panel" data-view="world"></div>');

    viewTabs.find('.wm-view-tab').on('click', function () {
        const view = $(this).data('view');
        viewTabs.find('.wm-view-tab').removeClass('active');
        $(this).addClass('active');
        contentRoot.find('.wm-view-panel').removeClass('active');
        contentRoot.find(`.wm-view-panel[data-view="${view}"]`).addClass('active');

        if (view === 'world') {
            const mapUrl = getCurrentWorldMapUrl();
            const allLocs = getCurrentWorldLocationMaps();
            renderWorldMapView(worldPanel, mapUrl, allLocs, {
                onLocationSelect: (l) => {
                    setCurrentLocationName(l.name);
                    saveCurrentLocation();
                },
                onLocationNavigate: (l) => {
                    setCurrentLocationName(l.name);
                    saveCurrentLocation();
                    renderLocationMapsPreview();
                },
            });
        }
    });

    const leaveLocBtn = $('<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> Salir de la localización</button>');
    leaveLocBtn.on('click', () => {
        setCurrentLocationName('');
        setCurrentBoardName('');
        saveCurrentLocation();
        saveCurrentBoard();
        renderLocationMapsPreview();
    });

    // Que tablero hay abierto se decide antes de dibujar: estando dentro de uno, salir de
    // la localidad y saltar al mapa del mundo no son cosas que ofrecer — y con un combate
    // en marcha, la pestana World era la puerta por la que se huia sin decidirlo.
    const locBoards = getLocationBoards(loc);
    const selectedBoard = locBoards.find(/** @param {{ name: string }} b */ (b) => b.name === currentBoardName) || null;

    if (!selectedBoard) contentRoot.append(leaveLocBtn, viewTabs, locationPanel, worldPanel);

    // Assign all party members without a location to the current location
    for (const m of partyMembers) {
        if (!m.mapPosition || !m.mapPosition.locationName) {
            m.mapPosition = m.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
            m.mapPosition.locationName = currentLocationName;
        }
    }

    const tokens = /** @type {import('../world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));

    // ---- Board drill-down: if a board is selected, show it instead of the location ----
    if (selectedBoard) {
        // Board selected — render board map with a "Back to location" button
        const backBtn = $(`<button class="menu_button wm-leave-loc-btn"><i class="fa-solid fa-arrow-left"></i> Volver a ${escapeHtml(loc.name)}</button>`);

        // Se queda a la vista, apagado y diciendo por que: esconderlo haria pensar que
        // salir del tablero ya no existe, cuando lo que pasa es que hay que acabar antes.
        const heldBack = holdDuringCombat(combatEncounter, 'board');
        backBtn.attr('title', heldBack || `Volver a ${loc.name}`);
        backBtn.prop('disabled', Boolean(heldBack));
        backBtn.on('click', () => {
            if (holdDuringCombat(combatEncounter, 'board')) return;
            setCurrentBoardName('');
            setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
            saveCurrentBoard();
            renderLocationMapsPreview();
        });
        const boardPanel = $('<div data-map-root></div>');
        // Tanda 10: dentro del Modo Juego, la mesa virtual: el tablero a toda la pantalla de juego y
        // lo demás en islas encima (volver va en la de arriba a la izquierda, `mountVttHud`).
        const vttOn = isShellOpen();
        contentRoot.toggleClass('wm-vtt', vttOn);
        if (vttOn) contentRoot.append(boardPanel);
        else contentRoot.append(backBtn, boardPanel);

        const boardTokens = /** @type {import('../world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));
        // Merge enemy tokens if combat is active on this board
        const enemyTokens = combatEncounter.active ? buildEnemyTokens() : [];
        const npcTokens = buildBoardNPCTokens(selectedBoard);
        // J19.5: las invocaciones, del lado del grupo.
        const allBoardTokens = [...boardTokens, ...enemyTokens, ...buildSummonTokens(), ...npcTokens];
        // El tamaño del propio tablero (un mapa en imagen mide su cuadrícula, J12.8) y su terreno
        // con lo que lleva encima: cotas y zonas de conjuro, que tapan la vista en la niebla.
        const boardContext = getActiveBoardContext();
        const boardGridW = boardContext.gridWidth;
        const boardGridH = boardContext.gridHeight;
        const tacticalState = getCombatBoardHighlightState(boardGridW, boardGridH);

        // Determine which tokens can be dragged
        let boardDraggableIds;
        if (combatEncounter.active) {
            const entry = getCurrentTurnEntry();
            boardDraggableIds = (entry && !entry.isEnemy) ? [Number(entry.id)] : [];
        } else {
            boardDraggableIds = getControlledMemberIds();
        }

        // Terrain, fog and the paint palette (wiki/ROADMAP.md, Fase A6).
        const boardTerrain = boardContext.board === selectedBoard ? boardContext.terrain : normalizeTerrain(selectedBoard.terrain);
        // J12.13: lo que diga el tablero; sin decirlo, los grandes llevan niebla y los demás no.
        const fogOn = fogOnFor(selectedBoard, boardGridW, boardGridH);
        const boardFog = normalizeFog(selectedBoard.fog);
        const sightNow = fogOn ? boardVisibility() : null;
        // E2.1: a oscuras, quien lleva la luz enciende la antorcha (si queda); y la luz, para dibujarla.
        if (!activeTerrainBrush) keepTorchLit();
        const lightNow = activeTerrainBrush ? null : lightForBoard();
        const partySight = allBoardTokens
            .filter(t => !t.isEnemy)
            .map(t => ({ gridX: t.gridX, gridY: t.gridY, sightFeet: sightNow ? sightFeetFor(sightNow, t.sightFeet ?? 60) : t.sightFeet }));
        const fogState = fogOn
            ? updateFog(boardFog, boardTerrain, partySight, boardGridW, boardGridH)
            : { fog: boardFog, visible: new Set() };

        if (fogOn && JSON.stringify(fogState.fog) !== JSON.stringify(boardFog)) {
            selectedBoard.fog = fogState.fog;
            persistBoardTerrain(selectedBoard);
        }

        // Fuera de combate, los enemigos que el tablero trae escritos y el grupo ve: se dibujan
        // quietos, y son los mismos que ofrece el botón de empezar. Solo lo que el grupo **ve
        // de verdad**: `awakePlacements` esconde a los de una sala sin revelar, y la niebla al
        // resto. Un tablero ya ganado no los vuelve a poner.
        // Tanda 16: lo que se ve por una puerta abierta ya no duerme (la Capitana Keller en su
        // tienda); un tablero guardado antes de saberlo se pone al día aquí, fuera de combate.
        if (!combatEncounter.active) {
            const seenRooms = revealThroughOpenDoors(selectedBoard.rooms, boardTerrain);
            if (seenRooms !== selectedBoard.rooms) {
                selectedBoard.rooms = seenRooms;
                persistBoardTerrain(selectedBoard);
            }
        }
        const inSight = combatEncounter.active || isBoardWon(currentLocationName, selectedBoard.name) ? [] : awakePlacements(selectedBoard.rooms, selectedBoard.enemyPlacements ?? [])
            .filter((/** @type {any} */ p) => !fogOn
                || fogState.visible.has(cellKey(Number(p.x) || 0, Number(p.y) || 0)));
        // E1.1: los que duermen se ven, pero no empiezan la pelea: hay que pasar sin despertarlos.
        const waiting = inSight.filter((/** @type {any} */ p) => !p.asleep);
        allBoardTokens.push(...buildBoardIdleEnemyTokens([...waiting, ...inSight.filter((/** @type {any} */ p) => p.asleep)]));
        const waitingKey = (/** @type {typeof lastWaiting} */ w) => `${w.board}|${w.placements.map(p => `${p.name}@${p.x},${p.y}`).join(';')}`;
        const nowWaiting = { board: String(selectedBoard.name), placements: waiting };
        if (waitingKey(nowWaiting) !== waitingKey(lastWaiting)) {
            lastWaiting = nowWaiting;
            // La fila de fichas se hizo antes que el tablero: se rehace una vez con lo nuevo.
            if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
        }

        // J12.11 y J12.13: a quién sigue la cámara (a quien le toca, o quien abre la marcha) y la
        // sala con nombre en la que está, con su nota, en la cabecera del tablero: se sabe dónde se
        // está sin mirar el registro.
        const followed = combatEncounter.active
            ? getCurrentActingMember()
            : (selectedWalker() ?? partyMembers.find(m => !m.dead
                && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName)) ?? null);
        const room = followed ? roomOf(followed) : null;
        const vttView = renderLocationView(boardPanel, {
            // Tanda 10: la cámara de la mesa virtual, sus marcadores de borde y el alcance al pasar.
            vtt: vttOn ? vttOptionsNow(fogOn ? fogState.visible : null, boardGridW, boardGridH) : null,
            name: room ? `${selectedBoard.name} · ${room.name}` : selectedBoard.name,
            imageUrl: selectedBoard.url,
            description: room?.note ?? '',
            followTokenId: followed?.id ?? null,
            followKey: followed ? `${followed.id}@${Number(followed.mapPosition?.gridX) || 0},${Number(followed.mapPosition?.gridY) || 0}` : '',
            gridWidth: boardGridW,
            gridHeight: boardGridH,
            viewStateKey: `board::${currentLocationName}::${selectedBoard.name}`,
            terrain: boardTerrain,
            fog: fogState.fog,
            visibleCells: fogState.visible,
            fogEnabled: fogOn,
            paintMode: activeTerrainBrush,
            onPaintCell: (gx, gy, type) => {
                selectedBoard.terrain = setTerrainCell(normalizeTerrain(selectedBoard.terrain), gx, gy, type);
                persistBoardTerrain(selectedBoard);
                renderLocationMapsPreview();
            },
            // Opening a door changes what can be walked through and what can be seen, so
            // the board is redrawn: fog is recomputed from the new terrain on the way.
            onDoorToggle: (gx, gy, open) =>
                toggleBoardDoor(selectedBoard, gx, gy, open, boardGridW, boardGridH),
            // K3: la ficha a la que le toca, a la vista (una vez por turno).
            ...activeFocus(),
            // Lo ya visto del tablero, a la vista (idea 122: el aceite que arde).
            hazards: visibleHazards(selectedBoard).map((/** @type {any} */ h) => ({ x: h.x, y: h.y, name: h.name, kind: h.kind, note: h.tell })),
            // J19.6: las zonas de conjuro del combate, a la vista, con lo que hacen.
            spellZones: zoneOverlay(activeSpellZones()),
            // E2.1: la penumbra y la oscuridad, y quién lleva la luz.
            light: lightNow,
            // J12.10 y J12.11: los acantilados se dibujan, y la casilla dice su sala y su altura.
            elevation: normalizeElevation(selectedBoard.elevation),
            zones: normalizeZones(selectedBoard.zones),
            // El bioma de las casillas en pixel, por el tipo del sitio si el nombre no lo dice.
            locationType: String(loc.type ?? ''),
            tokens: allBoardTokens,
            onTokenClick: (tokenId) => handleCombatTokenClick(tokenId),
            // Clic en una casilla encendida: mover. Solo las encendidas responden.
            onCellClick: (gx, gy, kind) => handleBoardCellClick(gx, gy, kind),
            // Y al pasar por encima, la ruta y el precio: mover deja de ser una apuesta.
            onCellHover: (gx, gy) => previewMovement(gx, gy),
            selectedTokenId: tacticalState.selectedTokenId,
            highlightedTokenIds: tacticalState.highlightedTokenIds,
            highlightedCells: tacticalState.highlightedCells,
            overlayLegend: tacticalState.overlayLegend,
            draggableTokenIds: boardDraggableIds,
            onTokenDragging: (tokenId, tentGX, tentGY) =>
                buildDragHighlightCells(tokenId, tentGX, tentGY, boardGridW, boardGridH),
            onTokenMove: (tokenId, gx, gy) => {
                // Tanda 10: colocándose antes de la pelea, soltar una ficha la coloca.
                if (placementDrop(tokenId, gx, gy)) return;
                if (tokenId < 0) {
                    handleEnemyTokenMove(tokenId, gx, gy);
                    return;
                }
                if (combatEncounter.active) {
                    const entry = getCurrentTurnEntry();
                    if (entry && !entry.isEnemy && String(entry.id) === String(tokenId)) {
                        // J19.5: también una invocación en su turno, que no es del grupo.
                        const member = getPartyMemberByTurnEntry(entry);
                        if (member) {
                            // Arrastrar la ficha **es** moverse igual que escribirlo, y
                            // hasta ahora eso era un comentario y no un hecho: esta rama
                            // tenia su propia copia del movimiento, que no guardaba la
                            // ficha, no narraba el paso y no miraba si con ese paso se
                            // ganaba el escenario. Una sola puerta y se acabo la deriva.
                            handlePlayerCombatMove(`${gx + 1},${gy + 1}`);
                            return;
                        }
                    }
                }
                handleTokenMove(tokenId, gx, gy, currentLocationName);
            },
        });
        // Tanda 10: las islas de la mesa virtual (volver; en combate, la iniciativa y el resumen).
        const vttTools = vttView ? mountVttHud(vttView, backBtn) : null;
        /** Donde va el pincel del terreno: en la mesa virtual, junto a «Volver». */
        const brushSlot = vttTools ?? boardPanel;

        // ---- Terrain editor (wiki/ROADMAP.md, Fase A6) ----
        // Con una pelea encima no se ofrece: mover un muro a mitad de un turno cambia
        // quien ve a quien, por donde se pasa y cuanto cuesta llegar, y nada de eso lo
        // habia decidido nadie. El pincel vuelve entero al acabar.
        const heldBrush = holdDuringCombat(combatEncounter, 'terrain');
        if (heldBrush) {
            // Si alguien dejo el pincel abierto y empezo el combate, se cierra solo.
            terrainEditing = false;
            activeTerrainBrush = null;
        }

        if (heldBrush) {
            // En la mesa virtual, en combate, ni apagado: la barra de arriba es para volver.
            const lockedBtn = $('<button class="wm-terrain-edit-btn menu_button" disabled></button>');
            lockedBtn.attr('title', heldBrush);
            lockedBtn.append('<i class="fa-solid fa-draw-polygon"></i>');
            lockedBtn.append($('<span></span>').text(' Terreno'));
            if (!vttTools) boardPanel.append(lockedBtn);
        } else if (terrainEditing) {
            const palette = buildTerrainPalette(selectedBoard, () => renderLocationMapsPreview(), fogOn);
            if (vttView) $(vttView.hud.topLeft).append(palette.addClass('vtt-island'));
            else boardPanel.append(palette);
        } else {
            const editButton = $('<button class="wm-terrain-edit-btn menu_button" title="Pintar muros, cobertura y puertas"></button>');
            editButton.append('<i class="fa-solid fa-draw-polygon"></i>');
            editButton.append($('<span></span>').text(' Terreno'));
            editButton.on('click', () => {
                terrainEditing = true;
                activeTerrainBrush = 'wall';
                renderLocationMapsPreview();
            });
            brushSlot.append(editButton);
        }


        // ---- La pelea empieza sola (tanda 10, `fight-entry.js`) ----
        // Ya no hay botón de «Iniciar combate»: si los que esperan os ven, la pelea se abre
        // sola (la decisión, si tiene otras salidas, y colocarse antes de la iniciativa). Solo
        // con lo que el grupo **ve de verdad**: `awakePlacements` esconde a los de una sala sin
        // revelar, y la niebla al resto.
        noticeBoardFight();

        // ---- Combat log (wiki/ROADMAP.md, Fase B4) ----
        // Beside the real board now, not only inside /sandbox. It appears once there is
        // something to show, so a quiet board is not covered by an empty panel.
        // Tanda 10: en la mesa virtual, el registro es el resumen de arriba a la derecha (`mountVttHud`).
        if (!vttView && (combatEncounter.active || combatLogEntries.length > 0)) {
            const logPanel = createCombatLogPanel({ title: 'Registro de combate' });
            contentRoot.append(logPanel);
            combatLogPanel = logPanel;
            // Idea 20: de quién y de qué. «Mis tiradas» es Tiradas más tu nombre.
            logPanel.attr('data-kind', combatLogFilter.kind).attr('data-who', combatLogFilter.who);
            const people = [...partyMembers.map(m => String(m.name)), ...combatEncounter.enemies.map((/** @type {any} */ e) => String(e.name))]
                .filter((name, index, all) => name && all.indexOf(name) === index);
            const repaint = () => {
                combatLogFilter = logFilterOf(logPanel);
                renderLogFilters(logPanel, people, repaint);
                paintCombatLog();
            };
            renderLogFilters(logPanel, people, repaint);
            paintCombatLog();
            setRound(logPanel, combatEncounter.active ? (Number(combatEncounter.round) || 1) : 0);
        }

        // ---- Combat UI section ----
        // Tanda 10: en la mesa virtual no va: la iniciativa, los objetivos y quién mueve a cada uno
        // están en la isla de la iniciativa, y el turno y sus botones, en la barra de abajo.
        if (combatEncounter.active && !vttView) {
            const combatSection = buildCombatSection(selectedBoard);
            contentRoot.append(combatSection);
        }
        return;
    }

    // ---- Location view (no board selected) ----
    renderLocationView(locationPanel, {
        name: loc.name,
        imageUrl: loc.url,
        description: loc.description || '',
        gridWidth: loc.gridWidth || 50,
        gridHeight: loc.gridHeight || 50,
        viewStateKey: `location::${loc.name}`,
        tokens,
        draggableTokenIds: getControlledMemberIds(),
        onTokenMove: (tokenId, gx, gy) => handleTokenMove(tokenId, gx, gy, currentLocationName),
    });

    // ---- Board cards below the location map ----
    if (locBoards.length > 0) {
        let boardCards = '';
        for (const b of locBoards) {
            const imgHtml = b.url
                ? `<img src="${escapeHtml(b.url)}" alt="" />`
                : '<i class="fa-solid fa-chess-board fa-2x"></i>';
            boardCards += `
            <div class="wm-loc-choose-card" data-board="${escapeHtml(b.name)}">
                <div class="wm-loc-choose-img">${imgHtml}</div>
                <div class="wm-loc-choose-name">${escapeHtml(b.name)}</div>
            </div>`;
        }
        const boardsSection = $(`
            <div class="wm-boards-section">
                <div class="wm-boards-section-title"><i class="fa-solid fa-chess-board"></i> Tableros</div>
                <div class="wm-loc-choose-grid">${boardCards}</div>
            </div>
        `);
        boardsSection.find('.wm-loc-choose-card').on('click', function () {
            setCurrentBoardName(String($(this).data('board')));
            setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
            saveCurrentBoard();
            placePartyAtStart(getLocationBoards(loc).find((/** @type {any} */ b) => b.name === currentBoardName));
            renderLocationMapsPreview();
        });
        contentRoot.append(boardsSection);
    } else {
        // Un sitio sin tablero es un sitio legitimo — una aldea donde solo se habla — y
        // desde A4 se puede escribir en un libro. Decirlo evita que parezca roto.
        contentRoot.append($('<div class="wm-boards-empty"></div>').text(
            'Aqui no hay ningun tablero: es un sitio para hablar y pasar el rato, no para pelear.',
        ));
    }
}
