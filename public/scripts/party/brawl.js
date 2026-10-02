/**
 * Las peleas de taberna y los duelos, en el juego (J12.7 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El motor lo decide todo (`combat/brawl.js`: la regla sin muertes y el tablero;
 * `campaign/tavern-brawl.js`: quién hay, qué se ofrece y qué pasa al acabar). Aquí se enchufa:
 *
 * - **En la taberna** (la tarjeta de la posada, que la pantalla del pueblo enseña en su sitio):
 *   atender a quien te busca pelea, armarla tú o retar al campeón por dinero. Cada cosa abre su
 *   escena de novela visual (`ui/avoid-scene.js`), con la cara de quien te provoca.
 * - **El duelo por honor**: si amenazas a alguien de armas tomar y no se asusta (`talk.js`).
 * - **La pelea**: un tablero de taberna en la localización, el combate de siempre con la bandera
 *   `brawl`, y los ganchos pequeños del combate que la leen (caer es quedar fuera de combate,
 *   los puños, sin magia que hiere, rendirse).
 * - **Al acabar** (`endCombat` la manda aquí): quien cayó se levanta, se cobra y se paga, la fama
 *   y las huellas del pueblo, la parte del día, el tablero fuera y la escena con lo que ha pasado.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, refreshWorldMapGlobals, METADATA_KEY } from '../world-info.js';
import { generateEnemyInstanceId } from '../dnd-system.js';
import {
    RULE_LINE, brawlOf, brawlBoard, brokenFurniture, countFurniture, knockOut, knockOutLine, rivalFighters, rowdyCount,
    standingFighters, verdictOf, wakeUp, wantsToYield, yieldLine, brawlRefusal,
} from '../game-engine/combat/brawl.js';
import {
    BRAWLS_KEY, CALM_DC, PEACE_PRICE, ROUND_PRICE, HONOR_FAME, brawlOutcome, challengedLately, challengerFor, championOf,
    dayPartLabel, fightLine, fillLine, noteBrawl, readFightRows, refuseHonor, rowdyBand, rowdyNow, stakesFor, tavernActions,
} from '../game-engine/campaign/tavern-brawl.js';
import { normalizeCalendar } from '../game-engine/campaign/calendar.js';
import { derive } from '../game-engine/campaign/seed.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { terrainFromAsciiMap } from '../game-engine/board/terrain.js';
import { rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import { openExitScene } from '../game-engine/ui/avoid-scene.js';
import { showBrawlBanner } from '../game-engine/ui/brawl-banner.js';
import { isShellOpen, refreshGameShell, setScene } from '../game-engine/ui/shell/game-shell.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatBoardSelection, setCombatEncounter,
    setCurrentBoardName,
} from './state.js';
import { createEmptyCombatEncounter, nextRandom, rollDiceDetailed } from './combat-rules.js';
import { getAliveEnemies, saveCombatState } from './combat-state.js';
import { endCombat, restoreChatPlaceholder, startBrawlFight } from './combat-flow.js';
import { beginPlacement } from './fight-entry.js';
import { endOfFightMagic } from './spell-turn.js';
import { enterBoard, getActiveBoardContext } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { hereLocation, lastCompendium, lastPack, lastWorldNpcs, leaveMark, saveCurrentBoard } from './world.js';
import { campaignDay, getCampaignCalendar, spendDayPart } from './time.js';
import { raiseFame } from './town.js';
import { partyPurse, payFromParty, renderPartyMembers, savePartyState } from './roster.js';
import { noteRollInWindow, postCombatNarration } from './narration.js';
import { changeAttitude } from './companions.js';
import { noteDeed, worldWrite } from './world-growth.js';
import { storyHero, storyNight } from './plot.js';
import { countStat } from './menus.js';

/** @typedef {import('../game-engine/combat/brawl.js').Brawl} Brawl */
/** @typedef {import('../game-engine/campaign/tavern-brawl.js').Fighter} Fighter */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Un d20 con el azar de la partida (la semilla, si la hay). */
const rollD20 = () => rollDiceDetailed('1d20', 20).total;

/** Lo escrito en `compendio/peleas.json`, leído (sin el archivo, lo de siempre). */
function fightRows() {
    return readFightRows(lastCompendium?.has?.('peleas') ? lastCompendium.find('peleas', {}) : []);
}

/** La franja de ahora, por su id (`morning`, `afternoon`, `night`). */
function slotNow() {
    const calendar = normalizeCalendar(getCampaignCalendar());
    return String(calendar.slots[calendar.slotIndex]?.id ?? '');
}

/**
 * La suerte de algo en esta taberna, esta franja: la misma mientras dure (el camorrista que te
 * busca no cambia por mirar dos veces).
 *
 * @param {string} what
 * @param {boolean} [bySlot] Si cambia con la franja; si no, es la del sitio (el campeón).
 * @returns {() => number}
 */
function luck(what, bySlot = true) {
    const seed = String(chat_metadata?.[METADATA_KEY] || '');
    return createSeededRandom(bySlot
        ? derive(seed, 'pelea', what, currentLocationName, String(Math.max(1, campaignDay())), slotNow())
        : derive(seed, 'pelea', what, currentLocationName));
}

/** Quien lleva la taberna de aquí, si se sabe. */
function innkeeper() {
    return lastWorldNpcs.find(n => !n.dead && n.service === 'posada' && fold(n.where) === fold(currentLocationName))?.name ?? '';
}

/** El nombre de la taberna de aquí, como lo dice el pueblo («El Agua Azul»), o «la taberna». */
function tavernName() {
    const places = /** @type {any} */ (hereLocation())?.places;
    const inn = Array.isArray(places) ? places.find((/** @type {any} */ p) => text(p?.kind) === 'posada') : null;
    return text(inn?.name) || 'la taberna';
}

/**
 * El nombre de la taberna dentro de una frase: «Pelea en la taberna», no «Pelea en La taberna».
 * Un nombre propio («El Agua Azul») se queda como está.
 *
 * @param {string} name
 * @returns {string}
 */
function inSentence(name) {
    return /^(la|el)\s+(taberna|posada|mes[oó]n|cantina|fonda)$/i.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

/** Los huecos de las frases, con lo de aquí. */
function factsHere() {
    return { heroe: storyHero(), pueblo: currentLocationName, taberna: inSentence(tavernName()), posadero: innkeeper() };
}

/** Quien camina por el grupo: en pie y vivo. */
function standing() {
    return partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0);
}

/**
 * Quien mejor hace algo, de los que están en pie.
 *
 * @param {string} skill
 * @returns {any}
 */
function bestAt(skill) {
    return standing().reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, skill).modifier > skillModifier(top, skill).modifier ? m : top), null);
}

/**
 * El camorrista de esta franja, si hay.
 *
 * @param {ReturnType<typeof fightRows>} rows
 * @returns {Fighter|null}
 */
function rowdyHere(rows) {
    return rowdyNow({ rows, random: luck('camorra'), town: currentLocationName, day: Math.max(1, campaignDay()), slot: slotNow(), log: chat_metadata?.[BRAWLS_KEY] });
}

/**
 * Apuntar lo que ha pasado en esta taberna.
 *
 * @param {'camorra'|'armada'|'duelo'|'honor'} what
 * @param {string} who
 */
function noteHere(what, who) {
    if (!chat_metadata) return;
    chat_metadata[BRAWLS_KEY] = noteBrawl(chat_metadata[BRAWLS_KEY], {
        town: currentLocationName, day: Math.max(1, campaignDay()), slot: slotNow(), what, who,
    });
    saveMetadata();
}

/** Pagar lo que se pueda, sin quedarse en negativo. Lo que se pagó. */
function payUpTo(/** @type {number} */ amount) {
    let owed = Math.max(0, Math.floor(Number(amount) || 0));
    let paid = 0;
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
        paid += taken;
    }
    return paid;
}

// ---------------------------------------------------------------------------------------
// En la taberna

/**
 * J12.7: lo que se puede hacer en la taberna de aquí, para la tarjeta de la posada
 * (`buildServiceCards`). Sin partida, nada.
 *
 * @returns {import('../game-engine/campaign/tavern-brawl.js').TavernAction[]}
 */
export function brawlCardActions() {
    if (!chat_metadata || !currentLocationName) return [];
    const rows = fightRows();
    const hero = storyHero();
    return tavernActions({
        rowdy: rowdyHere(rows),
        champion: championOf(rows, currentLocationName, luck('campeon', false)),
        town: currentLocationName,
        day: Math.max(1, campaignDay()),
        slot: slotNow(),
        log: chat_metadata[BRAWLS_KEY],
        purse: partyPurse(),
        fighting: combatEncounter.active,
        heroUp: Boolean(hero && !hero.dead && (Number(hero.hp) || 0) > 0),
        keeper: innkeeper(),
    });
}

/**
 * J12.7: una acción de la taberna (`runService`).
 *
 * @param {string} actionId `brawl-rowdy`, `brawl-start` o `brawl-duel`.
 * @returns {Promise<void>}
 */
export async function runBrawlAction(actionId) {
    if (actionId === 'brawl-rowdy') await meetRowdy();
    else if (actionId === 'brawl-start') await startTavernBrawl();
    else if (actionId === 'brawl-duel') await offerBetDuel();
}

/**
 * Alguien te busca pelea: su escena, con pelear, calmarle, invitarle a una ronda o irte.
 *
 * @returns {Promise<void>}
 */
async function meetRowdy() {
    const rows = fightRows();
    const rowdy = rowdyHere(rows);
    if (!rowdy || combatEncounter.active) return;
    const facts = { ...factsHere(), quien: rowdy.name };
    const talker = bestAt('persuasion');
    const mod = talker ? skillModifier(talker, 'persuasion').modifier : 0;
    const purse = partyPurse();
    let fight = false;
    const { picked } = await openExitScene({
        title: tavernName(),
        speaker: rowdy.name,
        intro: [fillLine(rowdy.opens, facts), fillLine(rowdy.says, facts)].filter(Boolean),
        choices: [
            { id: 'pelear', label: 'Pelear', icon: 'fa-hand-fist', text: 'Aceptas: a puñetazos, sin armas y sin muertes.', win: 'Si ganas, fama aquí y el posadero os lo agradece' },
            {
                id: 'calmar', label: 'Calmarle', icon: 'fa-comments', text: 'Le hablas despacio, sin bajar la mirada.',
                check: `Persuasión · CD ${CALM_DC}`, who: talker ? `Tira ${talker.name} (${mod >= 0 ? '+' : ''}${mod})` : '', win: 'Si sale, no hay pelea',
            },
            {
                id: 'ronda', label: 'Invitarle a una ronda', icon: 'fa-beer-mug-empty', text: 'Una ronda para él y para su mesa.',
                cost: `Cuesta ${ROUND_PRICE} de oro`, win: 'No hay pelea', locked: purse < ROUND_PRICE ? 'No os llega el oro.' : '',
            },
            { id: 'irse', label: 'Irte', icon: 'fa-person-walking-arrow-right', text: 'Te apartas sin contestar.', win: 'No hay pelea, pero se ríen un rato' },
        ],
        pack: lastPack,
        town: currentLocationName,
        night: storyNight(),
        kind: 'brawl',
        onPick: async (id) => {
            if (id === 'pelear') {
                fight = true;
                return null;
            }
            if (id === 'calmar') {
                const result = talker ? rollCheck({ member: talker, skill: 'persuasion', rollD20, dc: CALM_DC }) : null;
                const calmed = Boolean(result?.success);
                if (result) noteRollInWindow(talker, result);
                fight = !calmed;
                if (calmed) noteHere('camorra', rowdy.name);
                return {
                    said: 'Tranquilo. Nadie tiene por qué acabar en el suelo esta noche.',
                    rolls: result ? [result.said] : [],
                    lines: [fightLine(rows, calmed ? 'calmar-bien' : 'calmar-mal', facts, nextRandom)],
                    notes: [],
                    next: calmed ? 'Seguir' : '¡A pelear!',
                };
            }
            if (id === 'ronda') {
                if (!payFromParty(ROUND_PRICE)) return null;
                savePartyState();
                noteHere('camorra', rowdy.name);
                return { said: `¡${innkeeper() || 'Posadero'}, una ronda para esa mesa!`, rolls: [], lines: [fightLine(rows, 'ronda', facts, nextRandom)], notes: [`−${ROUND_PRICE} de oro.`], next: 'Seguir' };
            }
            noteHere('camorra', rowdy.name);
            return { said: '', rolls: [], lines: [fightLine(rows, 'irse', facts, nextRandom)], notes: [], next: 'Seguir' };
        },
    });
    postCombatNarration(`🍺 [TABERNA] ${rowdy.name} te busca pelea en ${inSentence(tavernName())}.`);
    if (picked && fight) {
        const band = rowdyBand(rows, rowdy, rowdyCount(standing().length), luck('banda'));
        await startBrawl({ kind: 'taberna', started: 'ellos', rival: rowdy, who: band });
    } else if (isShellOpen()) refreshGameShell();
}

/**
 * Armar tú la pelea: con la mesa de los que tienen más ganas.
 *
 * @returns {Promise<void>}
 */
async function startTavernBrawl() {
    const rows = fightRows();
    const random = luck('armar');
    const first = rows.rowdies[Math.floor(random() * rows.rowdies.length) % rows.rowdies.length];
    if (!first) return;
    const band = rowdyBand(rows, first, rowdyCount(standing().length), random);
    postCombatNarration(`🍺 [TABERNA] ${fightLine(rows, 'armar', { ...factsHere(), quien: first.name }, nextRandom)}`);
    await startBrawl({ kind: 'taberna', started: 'tu', rival: first, who: band });
}

/**
 * El duelo por dinero con el campeón de la taberna: su escena, y cuánto se apuesta.
 *
 * @returns {Promise<void>}
 */
async function offerBetDuel() {
    const rows = fightRows();
    const champion = championOf(rows, currentLocationName, luck('campeon', false));
    if (!champion || combatEncounter.active) return;
    const facts = { ...factsHere(), quien: champion.name };
    const purse = partyPurse();
    const can = stakesFor(purse);
    let stake = 0;
    await openExitScene({
        title: tavernName(),
        speaker: champion.name,
        intro: [fillLine(champion.opens, facts), fillLine(champion.says, facts), 'Tu gente se queda mirando desde la pared. Si pierdes o te rindes, pagas; si ganas, cobras.'].filter(Boolean),
        choices: [
            ...[5, 10, 25].map(s => ({
                id: `apuesta-${s}`, label: `Apostar ${s} de oro`, icon: 'fa-coins', text: `Pones ${s} de oro en la mesa.`,
                win: `Si ganas, +${s}; si pierdes, −${s}`, locked: can.includes(s) ? '' : `No llevas ${s} de oro.`,
            })),
            { id: 'no', label: 'Mejor no', icon: 'fa-hand', text: 'Hoy no.', win: '' },
        ],
        pack: lastPack,
        town: currentLocationName,
        night: storyNight(),
        kind: 'brawl',
        onPick: async (id) => {
            stake = id.startsWith('apuesta-') ? Number(id.slice('apuesta-'.length)) || 0 : 0;
            return null;
        },
    });
    if (stake > 0 && stake <= partyPurse()) {
        await startBrawl({ kind: 'duelo', way: 'apuesta', stake, rival: champion, who: [{ name: champion.name, archetype: champion.archetype }] });
    } else if (isShellOpen()) refreshGameShell();
}

/**
 * J12.7: el duelo por honor. Si a quien has amenazado (y no se ha asustado) le va el reto, se
 * cierra la charla y te reta: aceptar es pelear; no aceptar se sabe en el pueblo.
 *
 * @param {any} npc Como lo da `worldNpc` (su nombre y su oficio).
 * @param {(() => void)|null} [closeTalk] Cerrar la ventana de la charla.
 * @returns {Promise<boolean>} Si te ha retado.
 */
export async function honorChallengeAfterThreat(npc, closeTalk = null) {
    if (!chat_metadata || combatEncounter.active || !currentLocationName) return false;
    const rows = fightRows();
    const rival = challengerFor({ npc, rows });
    const hero = storyHero();
    if (!rival || !hero || (Number(hero.hp) || 0) <= 0) return false;
    if (challengedLately(chat_metadata[BRAWLS_KEY], rival.name, Math.max(1, campaignDay()))) return false;
    closeTalk?.();
    await new Promise(resolve => setTimeout(resolve, 350));
    const facts = { ...factsHere(), quien: rival.name };
    let accepted = false;
    await openExitScene({
        title: `Un reto en ${currentLocationName}`,
        speaker: rival.name,
        intro: [fillLine(rival.opens, facts), fillLine(rival.says, facts)].filter(Boolean),
        choices: [
            {
                id: 'aceptar', label: 'Aceptar el duelo', icon: 'fa-hand-fist', text: 'Te quitas el arma del cinto y la dejas en el suelo.',
                win: `Si ganas, +${HONOR_FAME.gana} de fama en ${currentLocationName}; si pierdes, ${HONOR_FAME.pierde}`,
            },
            { id: 'rechazar', label: 'No aceptar', icon: 'fa-person-walking-arrow-right', text: 'No vas a pelear por esto.', win: `${HONOR_FAME.rechaza} de fama en ${currentLocationName}` },
        ],
        pack: lastPack,
        town: currentLocationName,
        night: storyNight(),
        kind: 'brawl',
        onPick: async (id) => {
            if (id === 'aceptar') {
                accepted = true;
                return null;
            }
            const refused = refuseHonor({ rival: rival.name, town: currentLocationName, rows, hero, random: nextRandom });
            raiseFame(currentLocationName, refused.fame);
            for (const deed of refused.marks) leaveMark(deed, { place: 'plaza', who: rival.name });
            noteHere('honor', rival.name);
            noteDeed(`${hero.name} no aceptó el reto de ${rival.name} en ${currentLocationName}.`);
            return { said: 'No.', rolls: [], lines: refused.lines, notes: refused.notes, next: 'Seguir' };
        },
    });
    if (accepted) await startBrawl({ kind: 'duelo', way: 'honor', rival, who: [{ name: rival.name, archetype: rival.archetype || 'bestia-bandido' }] });
    else if (isShellOpen()) refreshGameShell();
    return true;
}

// ---------------------------------------------------------------------------------------
// La pelea

/**
 * El tablero de la pelea, en la localización de ahora, como guarda los suyos un encargo. Si ya
 * había uno con ese nombre (de una pelea a medias), se cambia.
 *
 * @param {any} board
 * @returns {Promise<boolean>}
 */
async function placeBrawlBoard(board) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !currentLocationName) return false;
    let placed = false;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const place = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l?.name === currentLocationName);
        if (!data || !place) return;
        place.boards = [...(Array.isArray(place.boards) ? place.boards : []).filter((/** @type {any} */ b) => b?.name !== board.name), board];
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        placed = true;
    });
    return placed;
}

/**
 * Quitar de la localización el tablero de la pelea, ya peleada.
 *
 * @param {string} town
 * @param {string} name
 * @returns {Promise<void>}
 */
async function removeBrawlBoard(town, name) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        const place = (data?.metadata?.locationMaps ?? []).find((/** @type {any} */ l) => l?.name === town);
        if (!data || !place || !Array.isArray(place.boards)) return;
        place.boards = place.boards.filter((/** @type {any} */ b) => !(b?.brawl && b?.name === name));
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
    });
}

/**
 * Empezar una pelea sin muertes, como empiezan todas (tanda 10: decisión → colocarse →
 * iniciativa). La decisión ya está tomada en la taberna (pelear, aceptar el reto, apostar o
 * armarla tú). Aquí: el tablero de taberna en la localización, cada uno en su casilla (en un
 * duelo, tu gente mirando desde la pared), los de enfrente quietos a la vista, el cartel con la
 * regla y la barra de colocarse (`fight-entry.js`); «Empezar» tira la iniciativa y el combate
 * lleva su bandera.
 *
 * @param {Object} input
 * @param {'taberna'|'duelo'} input.kind
 * @param {'honor'|'apuesta'|''} [input.way]
 * @param {'ellos'|'tu'|''} [input.started]
 * @param {number} [input.stake]
 * @param {Fighter} input.rival Quien provoca, reta o acepta.
 * @param {Array<{name: string, archetype?: string}>} input.who Los de enfrente.
 * @returns {Promise<boolean>}
 */
async function startBrawl({ kind, way = '', started = '', stake = 0, rival, who }) {
    if (!chat_metadata || combatEncounter.active || !currentLocationName) return false;
    const hero = storyHero();
    const up = standing();
    if (!hero || !up.includes(hero)) {
        toastr.warning('Hace falta tenerse en pie para pelear.', 'La taberna');
        return false;
    }
    // En un duelo pelea quien juega y los demás miran; en la taberna, todos.
    const fighters = kind === 'duelo' ? [hero] : [hero, ...up.filter(m => m !== hero)];
    const watchers = kind === 'duelo' ? up.filter(m => m !== hero) : [];
    const plan = brawlBoard({ kind, town: currentLocationName, fighters: fighters.length + watchers.length, rivals: who.length, random: luck('tablero') });
    const terrain = terrainFromAsciiMap(plan.board.map);
    const level = Math.max(1, Math.round(fighters.reduce((sum, m) => sum + (Number(m.level) || 1), 0) / fighters.length));
    const enemies = rivalFighters({ kind, way, level, who }).map((enemy, index) => ({
        ...enemy,
        instanceId: generateEnemyInstanceId(),
        gridX: plan.rivalCells[index]?.x ?? plan.rivalCells[0].x,
        gridY: plan.rivalCells[index]?.y ?? plan.rivalCells[0].y,
    }));
    const board = {
        name: plan.board.name,
        description: kind === 'duelo' ? 'Las mesas, apartadas contra las paredes; en medio, el corro.' : 'Serrín en el suelo, jarras en las mesas y nadie con ganas de irse.',
        url: '',
        gridWidth: plan.board.map[0].length,
        gridHeight: plan.board.map.length,
        terrain,
        // Las casillas de salida al colocarse: en un duelo, solo el corro (la pared es de los que miran).
        partyStart: plan.board.partyStart,
        // Los de enfrente, quietos a la vista mientras os colocáis (el tablero los dibuja como a
        // los que esperan; la pelea no empieza sola: `fight-entry.js` se salta los tableros `brawl`).
        enemyPlacements: enemies.map(e => ({ name: e.name, x: e.gridX, y: e.gridY, ...(e.archetype ? { archetype: e.archetype } : {}) })),
        objectives: [],
        // Se quita al acabar: no es un tablero del sitio.
        brawl: true,
    };
    const back = currentBoardName;
    if (!(await placeBrawlBoard(board))) {
        toastr.warning('No se ha podido montar la pelea.', 'La taberna');
        return false;
    }
    if (!enterBoard(board.name)) {
        toastr.warning('No se ha podido montar la pelea.', 'La taberna');
        return false;
    }
    // Cada uno a su casilla: quien pelea delante; en un duelo, los demás en la pared.
    [...fighters, ...watchers].forEach((member, index) => {
        const cell = plan.partyCells[index] ?? plan.partyCells[0];
        member.mapPosition = { locationName: currentLocationName, gridX: cell.x, gridY: cell.y };
    });
    savePartyState();
    /** @type {Brawl} */
    const brawl = {
        kind, way: kind === 'duelo' ? (way || 'apuesta') : '', started: kind === 'taberna' ? (started || 'ellos') : '',
        stake: Math.max(0, Math.floor(Number(stake) || 0)), rival: rival.name, town: currentLocationName, tavern: inSentence(tavernName()),
        board: board.name, furniture: countFurniture(terrain), watching: watchers.map(m => String(m.id)), rivals: enemies.length, back,
    };
    noteHere(kind === 'taberna' ? (started === 'tu' ? 'armada' : 'camorra') : way === 'honor' ? 'honor' : 'duelo', rival.name);
    postCombatNarration(`🥊 [COMBAT] ${RULE_LINE}`);
    renderPartyMembers();
    if (isShellOpen()) setScene('combat');
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    // El cartel con la regla, mientras os colocáis: se sabe antes de elegir sitio.
    showBrawlBanner({
        title: kind === 'taberna' ? `Pelea en ${brawl.tavern}` : `Duelo con ${rival.name}`,
        rule: RULE_LINE,
        stakes: kind === 'duelo' ? (brawl.way === 'apuesta' ? `${brawl.stake} de oro en la mesa.` : `Lo que se juega: lo que se diga de ti en ${brawl.town}.`) : '',
        watching: watchers.map(m => String(m.name)),
        ms: 7000,
    });
    // «Empezar»: la iniciativa, y el combate con su bandera.
    const launch = () => {
        if (combatEncounter.active) return;
        startBrawlFight(/** @type {any} */ (enemies), brawl);
        renderPartyMembers();
        renderLocationMapsPreview();
        if (isShellOpen()) {
            setScene('combat');
            refreshGameShell();
        }
    };
    const placing = beginPlacement({
        placements: enemies.map(e => ({ name: e.name, x: e.gridX, y: e.gridY })),
        start: launch,
        only: fighters.map(m => String(m.id)),
        title: kind === 'duelo' ? `Duelo con ${rival.name}: tu sitio` : `Pelea en ${brawl.tavern}: colocaos`,
        hint: kind === 'duelo'
            ? 'Elige dónde empiezas: pulsa una casilla azul (o arrastra tu ficha). «Empezar» tira la iniciativa.'
            : '',
        // Si se va del tablero sin empezar, la pelea no ha pasado: el tablero fuera y de vuelta.
        onDrop: () => {
            void removeBrawlBoard(brawl.town, brawl.board).then(() => renderLocationMapsPreview());
        },
    });
    if (!placing) launch();
    return true;
}

/**
 * J12.7: quien cae en una pelea sin muertes queda fuera de combate, sin salvaciones de muerte
 * (para `damagePartyMember`). Lo que se lee, o nulo si no es una pelea así o sigue en pie.
 *
 * @param {any} target
 * @returns {string[]|null}
 */
export function brawlKnockOut(target) {
    if (!brawlOf(combatEncounter) || !target || (Number(target.hp) || 0) > 0) return null;
    Object.assign(target, knockOut(target));
    return [knockOutLine(target.name)];
}

/**
 * J12.7: en un duelo, el rival que no puede más se rinde en su turno (para el turno de los
 * enemigos). Lo que se lee, o nulo si sigue peleando.
 *
 * @param {any} enemy
 * @returns {string|null}
 */
export function brawlEnemyTurn(enemy) {
    const brawl = brawlOf(combatEncounter);
    if (!brawl || !wantsToYield({ brawl, enemy, random: nextRandom })) return null;
    enemy.currentHp = 0;
    enemy.surrendered = true;
    saveCombatState();
    const said = `🏳️ [COMBAT] ${yieldLine(enemy.name)}`;
    if (getAliveEnemies().length === 0) {
        postCombatNarration(said);
        endCombat('victory');
        return '';
    }
    return said;
}

/**
 * J12.7: si algo no se puede usar en esta pelea (la magia que hiere). Lo dice.
 *
 * @param {any} ability
 * @returns {boolean} Si no se puede.
 */
export function brawlRefused(ability) {
    const refusal = brawlRefusal(ability, brawlOf(combatEncounter));
    if (refusal) toastr.warning(refusal, 'Sin muertes');
    return Boolean(refusal);
}

/**
 * J12.7: «Huir» y «Hablar» en una pelea sin muertes: rendirte o, en la taberna, acabarla
 * pagando una ronda.
 *
 * @returns {Promise<void>}
 */
export async function brawlTalk() {
    const brawl = brawlOf(combatEncounter);
    if (!brawl) return;
    const left = getAliveEnemies();
    const peace = PEACE_PRICE * Math.max(1, left.length);
    const purse = partyPurse();
    const losing = brawl.kind === 'taberna'
        ? (brawl.started === 'tu' ? 'Pagas una ronda y lo roto, y en el pueblo se ríen un poco' : 'Pagas una ronda y la mitad de lo roto')
        : brawl.way === 'apuesta' ? `Pierdes los ${brawl.stake} de oro de la mesa` : `${HONOR_FAME.rinde} de fama en ${brawl.town}`;
    let end = '';
    await openExitScene({
        title: brawl.kind === 'taberna' ? `Pelea en ${brawl.tavern}` : `Duelo con ${brawl.rival}`,
        speaker: left[0]?.name ?? brawl.rival,
        intro: [brawl.kind === 'taberna' ? 'Entre golpe y golpe, hay un momento para decir algo.' : `${brawl.rival} te mira y espera, con los puños arriba.`],
        choices: [
            { id: 'seguir', label: 'Seguir peleando', icon: 'fa-hand-fist', text: 'Todavía no has dicho la última palabra.', win: '' },
            { id: 'rendirse', label: 'Rendirte', icon: 'fa-flag', text: 'Levantas las manos: ya basta.', win: losing },
            ...(brawl.kind === 'taberna' ? [{
                id: 'ronda', label: 'Pagar una ronda para todos', icon: 'fa-beer-mug-empty', text: 'Gritas que la siguiente la pagas tú.',
                cost: `Cuesta ${peace} de oro`, win: 'Se acaba sin ganador', locked: purse < peace ? 'No os llega el oro.' : '',
            }] : []),
        ],
        pack: lastPack,
        town: brawl.town,
        night: storyNight(),
        kind: 'brawl',
        onPick: async (id) => {
            end = id;
            return null;
        },
    });
    if (!combatEncounter.active || !brawlOf(combatEncounter)) return;
    if (end === 'rendirse') endCombat('yield');
    else if (end === 'ronda' && payFromParty(peace)) endCombat('peace');
}

/**
 * J12.7: el final de una pelea sin muertes, en lugar del de siempre (`endCombat` lo manda aquí):
 * sin botín ni muertos ni prisioneros. Quien cayó se levanta con 1 PG; se cobra y se paga (lo
 * apostado, lo roto, lo que os quitan); la fama y las huellas del pueblo; la parte del día; el
 * tablero fuera y la vuelta adonde se estaba; y la escena con lo que ha pasado.
 *
 * @param {string} reason Lo que dice el combate: `victory`, `defeat`, `yield`, `peace`, `fled`…
 * @returns {boolean} Si era una pelea sin muertes (y ya se ha acabado aquí).
 */
export function endBrawl(reason) {
    const brawl = brawlOf(combatEncounter);
    if (!brawl) return false;
    postCombatNarration('🏁 [COMBAT] La pelea termina.');
    const magicEnds = endOfFightMagic();
    if (magicEnds.length > 0) postCombatNarration(`[COMBAT] ${magicEnds.join('\n')}`);
    // Sin nadie de los tuyos en pie no es rendirse: es perder (en un duelo, los que miran no cuentan).
    let verdict = verdictOf(reason);
    if (verdict !== 'gana' && standingFighters(partyMembers, brawl).length === 0) verdict = 'pierde';
    const broken = brokenFurniture(brawl, getActiveBoardContext().terrain);
    for (const member of partyMembers) {
        const up = wakeUp(member);
        if (up) Object.assign(member, up);
    }
    const rows = fightRows();
    const rival = [...rows.rowdies, ...rows.champions, ...rows.challengers].find(f => fold(f.name) === fold(brawl.rival)) ?? null;
    // Perder en la taberna: mientras estabais en el suelo, alguien os aligeró la bolsa.
    const lost = verdict === 'pierde' && brawl.kind === 'taberna' ? Math.min(partyPurse(), rollDiceDetailed('1d6', 6).total + 1) : 0;
    const hero = storyHero();
    const result = brawlOutcome({ brawl, verdict, broken, lost, rows, rival, facts: { heroe: hero, posadero: innkeeper() }, random: nextRandom });
    if (result.gold > 0 && hero) hero.gold = (Number(hero.gold) || 0) + result.gold;
    else if (result.gold < 0) payUpTo(-result.gold);
    const billed = payUpTo(result.bill);
    if (billed < result.bill) result.notes.push(`No llega para todo: ${result.bill - billed} de oro se quedan apuntados en la pizarra.`);
    if (result.fame !== 0) raiseFame(brawl.town, result.fame);
    for (const deed of result.marks) leaveMark(deed, { town: brawl.town, place: 'posada', who: brawl.rival });
    if (verdict === 'gana') countStat('wins');
    if (brawl.kind === 'duelo' && brawl.way === 'honor') {
        noteDeed(verdict === 'gana' ? `${hero?.name ?? 'Tu héroe'} ganó un duelo por honor a ${brawl.rival} en ${brawl.town}.`
            : `${brawl.rival} ganó un duelo por honor a ${hero?.name ?? 'tu héroe'} en ${brawl.town}.`);
        // Quien te ha ganado limpio o ha perdido contigo te mira con otros ojos.
        if (verdict === 'gana') changeAttitude(brawl.rival, 1, 'le ganaste en un duelo limpio');
    }
    // El combate, fuera; y de vuelta adonde se estaba, sin el tablero de la pelea.
    setCombatEncounter(createEmptyCombatEncounter());
    setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
    saveCombatState();
    restoreChatPlaceholder();
    setCurrentBoardName(brawl.back && brawl.back !== brawl.board ? brawl.back : '');
    saveCurrentBoard();
    void removeBrawlBoard(brawl.town, brawl.board).then(() => renderLocationMapsPreview());
    // Una pelea, o un duelo, se lleva su parte del día.
    spendDayPart('pelea', { label: dayPartLabel(brawl) });
    savePartyState();
    renderPartyMembers();
    if (chat_metadata) saveMetadata();
    postCombatNarration(`🍺 [TABERNA] ${result.title}. ${[...result.lines, ...result.notes].join(' ')}`);
    void showBrawlResult(brawl, result, verdict);
    return true;
}

/**
 * Esperar a que quien juega cierre los dados que quedan a la vista (como mucho `maxMs`: la escena
 * sale igual si se dejan abiertos).
 *
 * @param {number} [maxMs]
 * @returns {Promise<void>}
 */
async function afterDice(maxMs = 30000) {
    const end = Date.now() + maxMs;
    while (document.querySelector('.wm-dice-overlay.active') && Date.now() < end) {
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

/**
 * La escena del final: quien peleaba enfrente (o quien lleva la taberna), lo que ha pasado y lo
 * que cambia. Al cerrarla, de vuelta al pueblo.
 *
 * @param {Brawl} brawl
 * @param {import('../game-engine/campaign/tavern-brawl.js').BrawlResult} result
 * @param {string} verdict
 * @returns {Promise<void>}
 */
async function showBrawlResult(brawl, result, verdict) {
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    // Primero los dados del último golpe, y luego el final: si no, la escena tapaba los dados
    // y, al cerrarla, el puñetazo que tumbó a Rosa salía después de «Ganas el duelo».
    await afterDice();
    // El que paga lo roto es quien lleva la taberna; si no, quien peleaba enfrente.
    const keeper = innkeeper();
    const speaker = result.bill > 0 && keeper ? keeper : brawl.rival;
    await openExitScene({
        title: result.title,
        speaker,
        intro: [...result.lines, ...result.notes],
        choices: [{ id: 'seguir', label: 'Seguir', icon: 'fa-arrow-right', text: verdict === 'gana' ? 'Te sacudes el serrín de la ropa.' : 'Te levantas como puedes.', win: '' }],
        pack: lastPack,
        town: brawl.town,
        night: storyNight(),
        kind: 'brawl',
        onPick: async () => null,
    });
    if (isShellOpen()) {
        setScene('exploration');
        refreshGameShell();
    }
}
