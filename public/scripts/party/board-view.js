/**
 * El tablero en pantalla: el panel de la localización, las casillas encendidas, la paleta del
 * terreno, la tarjeta de un enemigo, los clics y el botón de empezar la pelea.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { getCurrentWorldMapUrl, getCurrentWorldLocationMaps } from '../world-info.js';
import { renderWorldMapView, renderLocationView } from '../world-map-renderer.js';
import { escapeHtml } from '../utils.js';
import {
    getDistanceInFeet, getAttackRangeFeet, getPlayerDamageFormula, getPlayerAttackModifier,
} from './combat-rules.js';
import { weaponBonus } from '../game-engine/rules/equipment.js';
import {
    normalizeTerrain, setCell as setTerrainCell, getTerrainOptions, cellKey,
} from '../game-engine/board/terrain.js';
import { isArea } from '../game-engine/rules/area.js';
import { supportActions } from '../game-engine/campaign/pet.js';
import { pairOptions } from '../game-engine/rules/pair-moves.js';
import { getReachableCells, findPath, getPathCost } from '../game-engine/board/pathfinding.js';
import { createEmptyFog, normalizeFog, updateFog } from '../game-engine/board/fog-of-war.js';
import { attackEdge, readManeuvers } from '../game-engine/combat/maneuvers.js';
import { perkBonus } from '../game-engine/rules/level-perks.js';
import { visibilityPenalties, sightFeetFor } from '../game-engine/world/visibility.js';
import { describeForecast } from '../game-engine/combat/forecast.js';
import { canWalk } from '../game-engine/board/walk.js';
import { visibleHazards } from '../game-engine/board/hazards.js';
import { buildTracker, describeTurn } from '../game-engine/combat/initiative-tracker.js';
import { hasAction } from '../game-engine/combat/turn-machine.js';
import { holdDuringCombat } from '../game-engine/combat/combat-hold.js';
import { traitBonus } from '../game-engine/campaign/feats.js';
import { buildTargetCard, describeTargetCard } from '../game-engine/combat/target-card.js';
import { awakePlacements } from '../game-engine/campaign/campaign-map.js';
import { planUltimate } from '../game-engine/combat/bond-perks.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { createCombatLogPanel, setRound, renderLogFilters, logFilterOf } from '../game-engine/ui/combat-log.js';
import { knownAbilities, usesLeft, canUseAbility, describeAbility } from '../game-engine/rules/abilities.js';
import { findOpportunityAttacks } from '../game-engine/combat/opportunity.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { LOCATION_MAPS_MANUAL_HIDDEN_KEY } from './keys.js';
import {
    combatBoardSelection, combatEncounter, combatLogEntries, currentBoardName, currentLocationName, partyMembers,
    setCombatBoardSelection, setCurrentBoardName, setCurrentLocationName, usedReactions,
} from './state.js';
import { currentPet, petSupport } from './pet.js';
import { abilityVictims, carriedNames, getAbilityCatalogue, useAbility } from './magic.js';
import {
    boardCellOf, getAliveEnemies, getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry,
    getCurrentTurnState, getPartyMemberByTurnEntry, getRemainingMovementFeet, getTargetArmorClass, heightFor,
    occupiedCellsFor, partyCell, partyFlanks, underYourHand,
} from './combat-state.js';
import { paintCombatLog } from './combat-log.js';
import { planFor } from './enemy-turn.js';
import { judgeCurrentScenario, restoreChatPlaceholder, startWaitingFight, waitingSummary } from './combat-flow.js';
import {
    endPlayerCombatTurn, handlePlayerCombatAttack, handlePlayerCombatMove, resolvePairStrike,
    resolveUltimateStrike,
} from './player-actions.js';
import {
    boardVisibility, buildBoardIdleEnemyTokens, buildBoardNPCTokens, buildEnemyTokens, buildTokens,
    getActiveBoardContext, getActiveBoardTerrain, handleEnemyTokenMove, handleTokenMove, isBoardWon,
    persistBoardTerrain, placePartyAtStart, toggleBoardDoor,
} from './board.js';
import { saveCurrentLocation, saveCurrentBoard, getLocationBoards } from './world.js';
import { getCampaignBonds } from './time.js';

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
    const pos = member.mapPosition || { gridX: 0, gridY: 0, locationName: '' };
    const attackable = getAttackableEnemiesForMember(member);
    /** @type {{gridX:number,gridY:number,kind:'attack'}[]} */
    const attackCells = attackable.map(enemy => ({ gridX: enemy.gridX || 0, gridY: enemy.gridY || 0, kind: 'attack' }));
    const movementCells = getReachableCells(
        getActiveBoardTerrain(), pos.gridX || 0, pos.gridY || 0, remainingFeet, gridWidth, gridHeight,
        { occupied: occupiedCellsFor(member) },
    // La casilla en la que ya estas no es un sitio al que moverte: pulsarla gastaria
    // cero pies, y encendida solo servia para que tu propia ficha se comiera el clic.
    ).filter(cell => cell.gridX !== (pos.gridX || 0) || cell.gridY !== (pos.gridY || 0));
    const overlayLegend = `${member.name} · Movimiento restante ${remainingFeet} ft · Rango ${getAttackRangeFeet(member)} ft${attackable.length ? ` · Objetivos: ${attackable.map(enemy => enemy.name).join(', ')}` : ' · Sin objetivos en rango'}`;

    return {
        selectedTokenId: member.id,
        highlightedTokenIds: attackable.map(enemy => -(combatEncounter.enemies.findIndex(candidate => candidate.instanceId === enemy.instanceId) + 1)).filter(id => id !== 0),
        highlightedCells: [...movementCells, ...attackCells],
        overlayLegend,
    };
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
 * @returns {JQuery}
 */
function buildTerrainPalette(board, onChange) {
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
        .toggleClass('active', Boolean(board?.fogEnabled));
    fogToggle.append('<i class="fa-solid fa-cloud"></i>');
    fogToggle.append($('<span></span>').text('Niebla'));
    fogToggle.on('click', () => {
        board.fogEnabled = !board.fogEnabled;
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
 * El boton de empezar el combate que el tablero ya tiene dibujado.
 *
 * Un libro de mazmorras coloca a sus monstruos en el mapa; hasta ahora, para pelear con
 * ellos habia que escribir `/fight` con su nombre y su cuenta, y el tablero ya sabia
 * ambas cosas. Solo cuenta lo que esta en una sala revelada: lo que duerme tras una
 * puerta cerrada sigue durmiendo.
 *
 * @param {any} board
 * @param {Array<{name: string, x: number, y: number}>} awake
 * @returns {JQuery<HTMLElement>}
 */
function buildStartCombatButton(board, awake) {
    const row = $('<div class="sc-row"></div>');
    row.append($('<div class="sc-what"></div>').text(`En el tablero: ${waitingSummary(awake)}`));

    const button = $('<button class="menu_button sc-btn" type="button"></button>');
    button.append('<i class="fa-solid fa-swords"></i>');
    button.append($('<span></span>').text(' Iniciar combate'));
    button.on('click', () => startWaitingFight(awake));
    row.append(button);
    return row;
}

/**
 * Los que el grupo ve esperando en el tablero abierto, tal y como los dibujó el último
 * repintado (con niebla y salas ya contadas). La ficha de «Iniciar combate» sale de aquí:
 * en la escena de diálogo el botón del tablero no se ve, y quien empezaba en la bodega del
 * gremio no tenía cómo pelear.
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
        hindered: visibilityPenalties(boardVisibility(), distanceFeet),
    });
    const forecast = describeForecast({
        attackMod: getPlayerAttackModifier(member, forecastRange) + traitBonus(member, enemy.name) + perkBonus(member, 'attack') + weaponBonus(member),
        armorClass: ac,
        mode: forecastEdge.mode,
        reasons: forecastEdge.reasons,
        formula: getPlayerDamageFormula(member, forecastRange),
        damageBonus: Math.max(0, getPlayerAttackModifier(member, forecastRange)),
        targetHp: Number(enemy.currentHp) || 0,
    });
    const intent = planFor(enemy);
    const intentTarget = partyMembers.find(m => String(m.id) === String(intent.targetId ?? intent.focusId ?? ''));

    // Las que este personaje se sabe y van sobre un enemigo, cada una con su veredicto:
    // un conjuro de 120 ft no esta "fuera de alcance" porque la espada llegue a 5.
    const usable = knownAbilities(member, getAbilityCatalogue())
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
    root.append($('<div class="tc-name"></div>').text(card.name));
    root.append($('<div class="tc-stats"></div>').text(describeTargetCard(card)));
    if (card.inRange) root.append($('<div class="tc-forecast"></div>').text(forecast.text));
    if (intentTarget) root.append($('<div class="tc-intent"></div>').text(`Va a por ${intentTarget.name}.`));
    // R3: lo que alcanzaría cada habilidad de área, antes de usarla. Colocarse importa.
    for (const ability of knownAbilities(member, getAbilityCatalogue()).filter(a => a.target === 'enemy' && isArea(a.area))) {
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
        const button = $('<button class="menu_button tc-btn" type="button"></button>').text(action.label);
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

    // Lo que impide actuar se dice, no se deja adivinar.
    const blocked = card.actions.filter(a => !a.enabled).map(a => a.reason);
    if (blocked.length === card.actions.length) {
        root.append($('<div class="tc-why"></div>').text(blocked[0]));
    }

    $('body').append($('<div class="tc-overlay"></div>').on('click', () => closeTargetCard()).append(root));
}

/** Cierra la tarjeta, si hay alguna. */
function closeTargetCard() {
    $('.tc-overlay').remove();
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
    const member = getCurrentActingMember();
    if (!combatEncounter.active || !member) return null;

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const { terrain, gridWidth: w, gridHeight: h } = getActiveBoardContext();
    const path = findPath(terrain, origin.gridX || 0, origin.gridY || 0, gridX, gridY, w, h, {
        // Las casillas ocupadas no se atraviesan, igual que al mover de verdad.
        occupied: occupiedCellsFor(member),
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
        party: partyMembers,
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
            row.append(entry.avatar
                ? $('<img class="wm-init-face" alt="">').attr('src', entry.avatar)
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
            const avatarHtml = enemy.avatar
                ? `<img src="${escapeHtml(enemy.avatar)}" alt="" />`
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

/**
 * Volver a dibujar el tablero. Para las pruebas y las herramientas que cambian el terreno
 * desde fuera: el juego ya redibuja solo cuando algo suyo lo cambia.
 */
export function refreshBoardView() {
    renderLocationMapsPreview();
}

export function renderLocationMapsPreview() {
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
        contentRoot.append(backBtn, boardPanel);

        const boardTokens = /** @type {import('../world-map-renderer.js').TokenData[]} */ (buildTokens(currentLocationName));
        // Merge enemy tokens if combat is active on this board
        const enemyTokens = combatEncounter.active ? buildEnemyTokens() : [];
        const npcTokens = buildBoardNPCTokens(selectedBoard);
        const allBoardTokens = [...boardTokens, ...enemyTokens, ...npcTokens];
        const tacticalState = getCombatBoardHighlightState(loc.gridWidth || 50, loc.gridHeight || 50);

        // Determine which tokens can be dragged
        let boardDraggableIds;
        if (combatEncounter.active) {
            const entry = getCurrentTurnEntry();
            boardDraggableIds = (entry && !entry.isEnemy) ? [Number(entry.id)] : [];
        } else {
            boardDraggableIds = getControlledMemberIds();
        }
        const boardGridW = loc.gridWidth || 50;
        const boardGridH = loc.gridHeight || 50;

        // Terrain, fog and the paint palette (wiki/ROADMAP.md, Fase A6).
        const boardTerrain = normalizeTerrain(selectedBoard.terrain);
        const fogOn = Boolean(selectedBoard.fogEnabled);
        const boardFog = normalizeFog(selectedBoard.fog);
        const sightNow = fogOn ? boardVisibility() : null;
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
        const waiting = combatEncounter.active || isBoardWon(currentLocationName, selectedBoard.name) ? [] : awakePlacements(selectedBoard.rooms, selectedBoard.enemyPlacements ?? [])
            .filter((/** @type {any} */ p) => !fogOn
                || fogState.visible.has(cellKey(Number(p.x) || 0, Number(p.y) || 0)));
        allBoardTokens.push(...buildBoardIdleEnemyTokens(waiting));
        const waitingKey = (/** @type {typeof lastWaiting} */ w) => `${w.board}|${w.placements.map(p => `${p.name}@${p.x},${p.y}`).join(';')}`;
        const nowWaiting = { board: String(selectedBoard.name), placements: waiting };
        if (waitingKey(nowWaiting) !== waitingKey(lastWaiting)) {
            lastWaiting = nowWaiting;
            // La fila de fichas se hizo antes que el tablero: se rehace una vez con lo nuevo.
            if (isShellOpen()) setTimeout(() => refreshGameShell(), 0);
        }

        renderLocationView(boardPanel, {
            name: selectedBoard.name,
            imageUrl: selectedBoard.url,
            description: '',
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
                if (tokenId < 0) {
                    handleEnemyTokenMove(tokenId, gx, gy);
                    return;
                }
                if (combatEncounter.active) {
                    const entry = getCurrentTurnEntry();
                    if (entry && !entry.isEnemy && String(entry.id) === String(tokenId)) {
                        const member = partyMembers.find(m => m.id === tokenId);
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
            const lockedBtn = $('<button class="wm-terrain-edit-btn menu_button" disabled></button>');
            lockedBtn.attr('title', heldBrush);
            lockedBtn.append('<i class="fa-solid fa-draw-polygon"></i>');
            lockedBtn.append($('<span></span>').text(' Terreno'));
            boardPanel.append(lockedBtn);
        } else if (terrainEditing) {
            boardPanel.append(buildTerrainPalette(selectedBoard, () => renderLocationMapsPreview()));
        } else {
            const editButton = $('<button class="wm-terrain-edit-btn menu_button" title="Pintar muros, cobertura y puertas"></button>');
            editButton.append('<i class="fa-solid fa-draw-polygon"></i>');
            editButton.append($('<span></span>').text(' Terreno'));
            editButton.on('click', () => {
                terrainEditing = true;
                activeTerrainBrush = 'wall';
                renderLocationMapsPreview();
            });
            boardPanel.append(editButton);
        }


        // ---- Iniciar combate (wiki/archivo/ROADMAP_JUEGO_SIN_COMANDOS.md, K2) ----
        // Solo con lo que el grupo **ve de verdad**. `awakePlacements` esconde a los de
        // una sala sin revelar, pero un tablero sin salas no esconde nada — y entonces el
        // boton anunciaba al Carcelero de Hierro antes de que nadie lo hubiera visto. Un
        // boton que te chiva lo que hay detras de la puerta es lo contrario de un juego.
        if (waiting.length > 0) contentRoot.append(buildStartCombatButton(selectedBoard, waiting));

        // ---- Combat log (wiki/ROADMAP.md, Fase B4) ----
        // Beside the real board now, not only inside /sandbox. It appears once there is
        // something to show, so a quiet board is not covered by an empty panel.
        if (combatEncounter.active || combatLogEntries.length > 0) {
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
        if (combatEncounter.active) {
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
