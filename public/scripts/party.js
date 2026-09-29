/**
 * El panel del grupo y todo el juego que cuelga de él.
 *
 * Era un solo archivo de veintidós mil líneas; desde J15.1 (wiki/ROADMAP_SIN_CONEXION.md) vive
 * en `party/`, un módulo por cosa, y este archivo solo dice dónde está cada una. Quien lo
 * importaba (script.js, campaigns.js, las pruebas del navegador) lo sigue importando igual.
 */

export {
    loadDndCatalog, adoptVeteranGear, giveStartingGear, setPartyFromWorldEntries, enterStartingBoard,
    applyCampaignRuleset, adoptPet, postJourney, postHomecoming, applyModeExtras, notePlot, recordFinishedCampaign,
    beginCampaignPlot, routeTyped, openCampaignBuilder, memberFromEntry, partySnapshot, adoptCarriedParty,
    seatPartyHero, giveStartingPurse, plotEndingTitle, refreshBoardView, addPartyMember, removePartyMember,
    updatePartyMemberFromPersona, getActivePartyLeader, getPartyDescription, initPartyPanel,
} from './party/main.js';
export {
    playCurrentTurnAlone, restPartyForSimulation, openBoardDoorsForSimulation, grantXpForSimulation,
    revealLocationsForSimulation, trainMercenariesForSimulation, levelUpForSimulation, getCombatEncounter,
    getPartyMembersSnapshot, getEngineSceneState, getBoardContextSnapshot,
} from './party/simulation.js';
