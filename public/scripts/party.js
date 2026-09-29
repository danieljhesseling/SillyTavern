/**
 * El panel del grupo y todo el juego que cuelga de él.
 *
 * Era un solo archivo de veintidós mil líneas; desde J15.1 (wiki/ROADMAP_SIN_CONEXION.md) vive
 * en `party/`, un módulo por cosa, y este archivo solo dice dónde está cada una. Quien lo
 * importaba (script.js, campaigns.js, las pruebas del navegador) lo sigue importando igual.
 */

export { openCampaignBuilder, initPartyPanel } from './party/main.js';
export {
    playCurrentTurnAlone, restPartyForSimulation, openBoardDoorsForSimulation, grantXpForSimulation,
    revealLocationsForSimulation, trainMercenariesForSimulation, levelUpForSimulation, getCombatEncounter,
    getPartyMembersSnapshot, getEngineSceneState, getBoardContextSnapshot,
} from './party/simulation.js';
export { adoptPet } from './party/pet.js';
export { postHomecoming, recordFinishedCampaign, seatPartyHero, giveStartingPurse } from './party/hub.js';
export { enterStartingBoard } from './party/board.js';
export { refreshBoardView } from './party/board-view.js';
export { applyCampaignRuleset } from './party/world.js';
export { notePlot, beginCampaignPlot, plotEndingTitle } from './party/plot.js';
export { applyModeExtras } from './party/modes.js';
export { postJourney } from './party/narration.js';
export {
    loadDndCatalog, adoptVeteranGear, giveStartingGear, setPartyFromWorldEntries, memberFromEntry, partySnapshot,
    adoptCarriedParty, addPartyMember, removePartyMember, updatePartyMemberFromPersona, getActivePartyLeader,
    getPartyDescription,
} from './party/roster.js';
export { routeTyped } from './party/talk.js';
