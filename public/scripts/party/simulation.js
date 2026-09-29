/**
 * Lo que se mira y se toca desde fuera sin pasar por la pantalla: las fotos del grupo, del
 * combate y del tablero para el gestor de contexto, y los atajos de `tools/sim-campana.mjs`.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata } from '../../script.js';
import { getCurrentWorldLocationMaps, getCurrentWorldNPCs, METADATA_KEY } from '../world-info.js';
import { migratePartyMember } from '../dnd-system.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { normalizeTerrain, getCell, unlockDoor } from '../game-engine/board/terrain.js';
import { perkChoices, takePerk } from '../game-engine/rules/level-perks.js';
import { hubRoster } from '../game-engine/campaign/hub.js';
import { awakePlacements } from '../game-engine/campaign/campaign-map.js';
import { planLevelUp, buildLevelUpPatch, validateAbilityPicks, ABILITIES } from '../game-engine/rules/level-up.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, setPartyMembers } from './state.js';
import {
    savePartyState, renderPartyMembers, getLocationBoards, getActiveBoardContext, postCombatNarration,
    toggleBoardDoor, campaign, revealLocations, isBoardWon,
} from './main.js';
import { getXpTable, getAbilityLevels } from './level-up.js';
import { getCurrentTurnEntry } from './combat-state.js';
import { resolveAllyTurnAction } from './combat-flow.js';
import { endPlayerCombatTurn } from './player-actions.js';

/** @typedef {import('./types.js').PartyMember} PartyMember */

/** Export combat state for external access (e.g., script.js AI injection) */
/**
 * Para la simulación de campañas (`tools/sim-campana.mjs`): quien tiene el turno lo juega
 * solo, sea el héroe o un compañero, como con «Que actúe solo».
 *
 * @returns {boolean} Si había un turno del grupo que jugar.
 */
export function playCurrentTurnAlone() {
    const entry = getCurrentTurnEntry();
    if (!entry || entry.isEnemy || !combatEncounter.active) return false;
    postCombatNarration(resolveAllyTurnAction(entry));
    if (combatEncounter.active) endPlayerCombatTurn();
    return true;
}

/**
 * Para la simulación de campañas: el descanso largo sin esperar al día, y quien cayó se
 * levanta. Lo que se mide son las peleas, no la mala suerte de la anterior.
 */
export function restPartyForSimulation() {
    for (const member of partyMembers) {
        member.dead = false;
        member.hp = Number(member.maxHp) || Number(member.hp) || 1;
        member.activeConditions = [];
    }
    savePartyState();
    renderPartyMembers();
}

/**
 * Para la simulación de campañas: abrir todas las puertas del tablero, con llave o sin
 * ella, como haría quien juega yendo a por lo que hay detrás.
 *
 * @returns {number} Cuántas se abrieron.
 */
export function openBoardDoorsForSimulation() {
    const context = getActiveBoardContext();
    if (!context.board || combatEncounter.active) return 0;
    const closed = [];
    for (let y = 0; y < context.gridHeight; y++) {
        for (let x = 0; x < context.gridWidth; x++) {
            const cell = getCell(normalizeTerrain(context.board.terrain), x, y);
            if (cell.type === 'door' && !cell.open) closed.push({ x, y });
        }
    }
    for (const door of closed) {
        if (combatEncounter.active) break;
        context.board.terrain = unlockDoor(normalizeTerrain(context.board.terrain), door.x, door.y);
        toggleBoardDoor(context.board, door.x, door.y, true, context.gridWidth, context.gridHeight);
    }
    return closed.length;
}

/**
 * Para la simulación de campañas: subir de nivel a quien pueda, como lo haría quien juega
 * desde la ficha, con lo de por defecto (los puntos, a lo más alto; la primera mejora).
 *
 * @returns {Promise<string[]>} Quién subió, y a qué nivel.
 */
/**
 * Para la simulación de campañas: la experiencia que haría falta para empezar en un nivel,
 * a quien no es invitado. Luego `levelUpForSimulation` sube, un nivel por llamada.
 *
 * @param {number} xp
 */
export function grantXpForSimulation(xp) {
    for (const member of partyMembers.filter(m => !m.guest)) member.xp = (Number(member.xp) || 0) + Math.max(0, Number(xp) || 0);
    savePartyState();
}

/**
 * Para la simulación de campañas: poner en el mapa un sitio escondido, como haría el hilo o
 * un rumor, para poder jugar su tablero sin jugar antes lo que lo revela.
 *
 * @param {string[]} names
 * @returns {Promise<void>}
 */
export function revealLocationsForSimulation(names) {
    return revealLocations(names);
}

/**
 * Para la simulación de campañas: los mercenarios entrenan hasta el nivel del héroe, como
 * al ir y volver del gremio (`hubRoster`). Sin esto se quedaban a nivel 1 toda la campaña.
 */
export function trainMercenariesForSimulation() {
    setPartyMembers(hubRoster(partyMembers).map(member => migratePartyMember(member)));
    savePartyState();
    renderPartyMembers();
}

export async function levelUpForSimulation() {
    const hitDieByClass = await campaign.getHitDiceByClass();
    /** @type {string[]} */
    const said = [];
    for (const member of partyMembers.filter(m => !m.dead && !m.guest)) {
        const plan = planLevelUp({ member, table: getXpTable(), abilityLevels: getAbilityLevels(), hitDieByClass });
        if (!plan.canLevel) continue;
        const best = [...ABILITIES].sort((a, b) => (Number(member[b]) || 10) - (Number(member[a]) || 10))[0];
        const picks = plan.pointsToSpend > 0 ? { [best]: plan.pointsToSpend } : {};
        if (!validateAbilityPicks(picks, plan, member).ok) continue;
        Object.assign(member, buildLevelUpPatch(member, plan, picks));
        const offered = perkChoices({
            member,
            random: createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mejora', String(member.id), String(plan.to))),
        });
        const perkPatch = offered.length > 0 ? takePerk(member, offered[0].id) : null;
        if (perkPatch) Object.assign(member, perkPatch);
        said.push(`${member.name} ${plan.to}`);
    }
    savePartyState();
    renderPartyMembers();
    return said;
}

export function getCombatEncounter() {
    return combatEncounter;
}

/**
 * Read-only snapshot of current party state for external modules.
 * @returns {PartyMember[]}
 */
export function getPartyMembersSnapshot() {
    try {
        return JSON.parse(JSON.stringify(partyMembers || []));
    } catch {
        return [];
    }
}

/**
 * La escena según el motor, para el gestor de contexto (U1 del pegamento): combate si hay un
 * encuentro, exploración en un tablero, social en un sitio. Sin partida del juego, nada, y
 * entonces manda la que se elija a mano con `/cstate`.
 *
 * @returns {string}
 */
export function getEngineSceneState() {
    if (!chat_metadata?.[METADATA_KEY]) return '';
    if (combatEncounter.active) return 'combat';
    if (currentBoardName) return 'exploration';
    return currentLocationName ? 'social' : 'idle';
}

/**
 * Get a snapshot of all characters/NPCs/enemies present on the current board/location.
 * Used by the Dynamic Context Manager to inject board awareness into AI context.
 * @returns {{ locationName: string, boardName: string, partyTokens: Array<{name: string}>, npcTokens: Array<{name: string}>, enemyTokens: Array<{name: string}>, fighting: boolean }}
 */
export function getBoardContextSnapshot() {
    /** @type {{name: string}[]} */
    const partyTokens = [];
    /** @type {{name: string}[]} */
    const npcTokens = [];
    /** @type {{name: string}[]} */
    const enemyTokens = [];
    const snapshot = {
        locationName: currentLocationName || '',
        boardName: currentBoardName || '',
        partyTokens,
        npcTokens,
        enemyTokens,
        // Sin pelea, los enemigos que salen son los que el tablero trae y todavía no pelean:
        // el prompt no puede decir «en combate» (Daniel lo vio en el prompt, 2026-09-28).
        fighting: Boolean(combatEncounter.active),
    };

    if (!currentLocationName) return snapshot;

    // Party members at current location
    for (const m of partyMembers) {
        const pos = m.mapPosition || { locationName: '', gridX: 0, gridY: 0 };
        if (pos.locationName === currentLocationName) {
            snapshot.partyTokens.push({ name: m.name });
        }
    }

    // Board NPCs (if a board is selected)
    if (currentBoardName) {
        const locationMaps = getCurrentWorldLocationMaps();
        const loc = locationMaps.find(l => l.name === currentLocationName);
        if (loc) {
            const locBoards = getLocationBoards(loc);
            const board = locBoards.find(/** @param {{ name: string }} b */ (b) => b.name === currentBoardName);
            if (board?.npcPlacements && Array.isArray(board.npcPlacements)) {
                const worldNPCs = getCurrentWorldNPCs();
                for (const placement of board.npcPlacements) {
                    const npc = worldNPCs.find(n => n.id === placement.npcId);
                    if (npc) {
                        snapshot.npcTokens.push({ name: npc.name });
                    }
                }
            }
        }
    }

    // Combat enemies (if active)
    if (combatEncounter.active && combatEncounter.enemies.length > 0) {
        for (const e of combatEncounter.enemies) {
            snapshot.enemyTokens.push({ name: e.name });
        }
    } else if (currentBoardName && !isBoardWon(currentLocationName, currentBoardName)) {
        // Sin pelea, los que el tablero trae escritos y están a la vista: los mismos que se dibujan.
        const board = getActiveBoardContext().board;
        for (const p of awakePlacements(board?.rooms, board?.enemyPlacements ?? [])) {
            snapshot.enemyTokens.push({ name: String(p.name) });
        }
    }

    return snapshot;
}
