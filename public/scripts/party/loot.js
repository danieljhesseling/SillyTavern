/**
 * Lo que se gana: el botín de un encuentro, los cofres, las reliquias y la llave del tablero.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import { addItemToInventory, createItem } from '../dnd-system.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { forgeItem as forgeFromCompendium, describeItem } from '../game-engine/compendio/forge.js';
import { makeNames } from '../game-engine/compendio/names.js';
import { rollDice, nextRandom } from './combat-rules.js';
import { normalizeTerrain, setCell as setTerrainCell, lockedDoors } from '../game-engine/board/terrain.js';
import { trophiesOf, trophyItem } from '../game-engine/campaign/trophies.js';
import { rollEncounterLoot, lootRulesWithWorldItems, DEFAULT_LOOT_RULES } from '../game-engine/combat/loot.js';
import { lootable, relicsFor, describeRelic } from '../game-engine/campaign/relics.js';
import { dressLoot } from '../game-engine/campaign/item-lore.js';
import { describeLootItem } from '../game-engine/combat/loot-items.js';
import { treasureInChest } from '../game-engine/campaign/scenarios.js';
import { RELICS_GIVEN_KEY } from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers, worldItemCatalogue } from './state.js';
import { deliverTakenContract } from './contracts.js';
import { checkScenarioOutcome } from './combat-flow.js';
import { persistBoardTerrain, getActiveBoardContext } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { lastCompendium } from './world.js';
import { campaignDay } from './time.js';
import { noteDeed, mixSource } from './world-growth.js';
import { postCombatNarration, soundCue } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';

/**
 * R6: abrir un cofre. Hace falta estar al lado; da oro y, a veces, algo de valor. Se queda
 * vacío (en suelo).
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 */
export function openChest(board, gx, gy) {
    const opener = partyMembers.find(m => !m.dead && (Number(m.hp) || 0) > 0
        && Math.max(Math.abs((Number(m.mapPosition?.gridX) || 0) - gx), Math.abs((Number(m.mapPosition?.gridY) || 0) - gy)) <= 1);
    if (!opener) {
        toastr.info('Hay que llegar al lado del cofre para abrirlo.', 'Un cofre');
        return;
    }
    const gold = 5 + Math.floor(nextRandom() * 10) * 3;
    opener.gold = (Number(opener.gold) || 0) + gold;
    // Si la misión del tablero pide un tesoro, está en el cofre: es lo que hace que
    // «Encontrar la reliquia» se pueda cumplir.
    const wanted = treasureInChest(board?.objectives, collectedHere(board));
    const rare = nextRandom() < 0.4;
    const pool = DEFAULT_LOOT_RULES.itemsByRarity[rare ? 'Uncommon' : 'Common'] ?? [];
    const name = wanted || (pool.length > 0 && nextRandom() < 0.6 ? pool[Math.floor(nextRandom() * pool.length) % pool.length] : '');
    if (name) addItemToInventory(/** @type {any} */ (opener), createItem(/** @type {any} */ (describeLootItem(name, wanted ? '' : rare ? 'Uncommon' : 'Common', worldItemCatalogue))));
    if (wanted) {
        board.collectedTreasures = [...collectedHere(board), wanted];
        if (combatEncounter.active) combatEncounter.collectedTreasures = board.collectedTreasures;
    }
    board.terrain = setTerrainCell(normalizeTerrain(board.terrain), gx, gy, 'floor');
    persistBoardTerrain(board);
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    postCombatNarration(`🧰 [TABLERO] ${opener.name} abre el cofre: ${gold} de oro${name ? ` y ${name}` : ''}.`);
    if (wanted) {
        toastr.success(`${opener.name} encuentra ${wanted}.`, 'Lo que buscabais');
        if (combatEncounter.active) checkScenarioOutcome();
    }
}

/**
 * Los tesoros de la misión que ya se han sacado de este tablero, con o sin pelea.
 *
 * @param {any} board
 * @returns {string[]}
 */
export function collectedHere(board) {
    return [...new Set([
        ...(Array.isArray(board?.collectedTreasures) ? board.collectedTreasures : []),
        ...(combatEncounter.active && Array.isArray(combatEncounter.collectedTreasures) ? combatEncounter.collectedTreasures : []),
    ].map(String))];
}

/**
 * Ideas 119 y 135: de quién fue lo que cae. Un nombre del compendio y un sitio del mundo.
 *
 * Con su propia semilla (mundo, objeto, día y cuál): el mismo botín cuenta lo mismo, y los
 * dados del combate no se enteran de que alguien ha inventado una historia.
 *
 * @param {string} name
 * @param {number} index
 * @returns {{owner: string, place: string, random: () => number}}
 */
function lootLore(name, index) {
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'botin', String(name), String(campaignDay()), String(index)));
    const owner = lastCompendium?.has?.('nombres')
        ? String(makeNames({ compendium: lastCompendium, howMany: 1, random })[0] ?? '')
        : '';
    const places = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name ?? '')).filter(Boolean);
    const place = places.length > 0 ? places[Math.floor(random() * places.length) % places.length] : currentLocationName;
    return { owner: owner || ['Brunilda', 'Odo el Tuerto', 'Mencía', 'Rodrigo de la Cruz'][Math.floor(random() * 4) % 4], place, random };
}

/**
 * Hands out what the encounter was worth.
 *
 * Only on a victory: walking away or being wiped out leaves the bodies where they are.
 * Everything is rolled by the engine and announced line by line, like every other combat
 * result, so a player can see where their gold came from.
 *
 * @param {Array<any>} defeated
 * @returns {{gold: number, xp: number, items: Array<any>}|null}
 */
export function awardEncounterLoot(defeated) {
    const standing = partyMembers.filter(m => (m.hp || 0) > 0);
    // Los invitados (el mercenario, el escoltado) no van a partes: al mercenario ya se le
    // pagó al contratarle. Antes se llevaba su parte del oro y de la experiencia, y con dos
    // mercenarios el héroe subía de nivel a un tercio de lo que debía.
    const own = standing.filter(m => !m.guest);
    const survivors = own.length > 0 ? own : standing;
    if (survivors.length === 0 || defeated.length === 0) return null;

    // Lo que el autor de la campana haya escrito cae tambien, con la rareza que le puso.
    // Sin esto, escribir objetos seria llenar una lista que el juego no mira.
    const loot = rollEncounterLoot(defeated, survivors.length, {
        roll: (/** @type {string} */ formula) => rollDice(formula, 6),
        // Idea 132: las reliquias no caen como botín: llegan con su hito o su encargo.
        rules: lootRulesWithWorldItems(lootable(worldItemCatalogue)),
    });

    for (const member of survivors) {
        member.gold = (Number(member.gold) || 0) + loot.goldEach;
        member.xp = (Number(member.xp) || 0) + loot.xpEach;
    }

    // Objetos de verdad, no texto. Una pocion que no se puede beber y una espada que no
    // se puede equipar son ambientacion con pasos de mas: lo que cae entra en el
    // inventario como `DndItem`, con su tipo, su peso y su ranura.
    if (loot.items.length > 0) {
        // Un miembro del grupo *es* su ficha: lleva `items` directamente.
        const holder = survivors[0];
        holder.items = holder.items ?? [];
        loot.items.forEach((dropped, index) => {
            const spec = describeLootItem(dropped.name, dropped.rarity, worldItemCatalogue);
            // Ideas 119 y 135: lo de las tablas trae historia, y alguno muerde. Lo escrito
            // por el mundo ya trae la suya.
            const written = worldItemCatalogue.some((/** @type {any} */ i) => String(i?.name ?? '').toLowerCase() === String(dropped.name).toLowerCase());
            const item = createItem(/** @type {any} */ (written ? spec : dressLoot(spec, lootLore(String(dropped.name), index))));
            addItemToInventory(/** @type {any} */ (holder), item);
        });
    }

    // G5: a veces, algo forjado que no estaba en ninguna lista. Solo de quien plantaba cara
    // (desafio de medio para arriba), y en la parte que la curva deja a lo generado.
    const worthy = defeated.some((/** @type {any} */ e) => Number(e?.cr) >= 0.5);
    if (worthy && survivors[0] && lastCompendium.has('materiales') && mixSource({ written: true }) !== 'written') {
        const forged = forgeFromCompendium({ compendium: lastCompendium, random: nextRandom });
        if (forged) {
            addItemToInventory(/** @type {any} */ (survivors[0]), createItem(/** @type {any} */ (dressLoot(forged, lootLore(String(forged.name), -1)))));
            postCombatNarration(`🗡️ [COMBAT] Entre lo que dejaron: ${describeItem(forged)}.`);
        }
    }

    for (const line of loot.lines) postCombatNarration(line);
    if (loot.goldEach > 0) soundCue('coin');

    // Idea 121: las bestias dejan materiales, para la herrería.
    if (survivors[0]) {
        for (const enemy of defeated) {
            for (const name of trophiesOf(enemy, nextRandom)) {
                addItemToInventory(/** @type {any} */ (survivors[0]), createItem(/** @type {any} */ (trophyItem(name))));
                postCombatNarration(`🦴 [COMBAT] De ${String(enemy?.name ?? 'la bestia')}: ${name}.`);
            }
        }
    }

    // Levelling is not automatic: the sheet already has a button for it, and deciding
    // when to level is a player's business, not the engine's.
    for (const member of survivors) {
        if (member.xpNext > 0 && member.xp >= member.xpNext) {
            postCombatNarration(`⭐ [COMBAT] ${member.name} tiene experiencia para subir de nivel.`);
            soundCue('level');
        }
    }

    savePartyState();
    deliverTakenContract();
    return { gold: loot.gold, xp: loot.xp, items: loot.items };
}

/**
 * Idea 132: las reliquias que llegan con lo que se acaba de cumplir. Devuelve lo que hay que
 * contarle al narrador.
 *
 * @param {{kind: 'milestone'|'contract', id: string}} event
 * @returns {string[]}
 */
export function deliverRelics(event) {
    if (!chat_metadata) return [];
    const given = Array.isArray(chat_metadata[RELICS_GIVEN_KEY]) ? chat_metadata[RELICS_GIVEN_KEY] : [];
    const relics = relicsFor(worldItemCatalogue, event, given);
    const holder = partyMembers.find(m => !m.dead && (Number(m.hp) || 0) > 0) ?? partyMembers[0];
    if (relics.length === 0 || !holder) return [];
    holder.items = holder.items ?? [];
    for (const relic of relics) {
        const item = createItem(/** @type {any} */ ({ ...describeLootItem(String(relic.name), String(relic.rarity ?? ''), worldItemCatalogue), relic: true }));
        addItemToInventory(/** @type {any} */ (holder), item);
        chat_metadata[RELICS_GIVEN_KEY] = [...(chat_metadata[RELICS_GIVEN_KEY] ?? []), String(relic.name)];
        noteDeed(`${holder.name} lleva ahora ${relic.name}.`);
        toastr.success(describeRelic(relic), '🏺 Una reliquia', { timeOut: 12000 });
    }
    saveMetadata();
    savePartyState();
    return relics.map(relic => `${holder.name} se queda con ${describeRelic(relic)}`);
}

/**
 * Idea 77: al ganar en un tablero con puertas cerradas con llave, la llave, una vez.
 */
export function dropBoardKey() {
    const context = getActiveBoardContext();
    if (!context.board || lockedDoors(normalizeTerrain(context.board.terrain)).length === 0) return;
    const hero = partyMembers[0];
    const name = `Llave de ${currentBoardName || 'este sitio'}`;
    if (!hero || (hero.items ?? []).some((/** @type {any} */ i) => i?.name === name)) return;
    hero.items = hero.items ?? [];
    addItemToInventory(/** @type {any} */ (hero), createItem(/** @type {any} */ ({ name, type: 'gear', category: 'gear', subcategory: 'tool', weight: 0.1, description: 'Abre las puertas cerradas de este sitio.' })));
    savePartyState();
    postCombatNarration(`🗝️ [COMBAT] Entre lo que dejaron: ${name}.`);
}
