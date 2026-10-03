/**
 * E2 de wiki/ROADMAP_ENTRETENIDO.md, «La mazmorra que pesa»: el pegamento con la partida.
 *
 * - **E2.1, la luz** (`board/light.js`): la luz de cada casilla del tablero abierto, quién lleva
 *   la antorcha (y la enciende, gastándola), lo que la luz le hace a cada ataque
 *   (`lightHindrance`, que lee `attackHindrance`) y a buscar trampas, y la mano de la antorcha
 *   (el escudo que no se usa).
 * - **E2.2, las cerraduras** (`board/lock-picking.js`): la puerta cerrada con llave, con su riesgo.
 * - **E2.3, dormir en la mazmorra** (`campaign/dungeon-camp.js`): raciones, emboscada, sorpresa y
 *   la armadura pesada que se quitó para dormir; el descanso se reanuda al ganar.
 * - **E2.4, seguir o volver** (`campaign/press-on.js`): tras ganar una sala con algo más por
 *   delante, uno de los tuyos pregunta. Y el kit de curandero, que se gasta.
 *
 * Todo lo que se dice lo dice alguien que está (D-J60); lo demás va en un aviso fuera de la caja.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldEnemies, getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import {
    ambientLight, darkvisionOf, lightSources, lightLevelAt, seenAs, sightEdge, perceptionInLight, planLight,
    spendTorch, describeLight, shieldBonusOf, torchBurning, handFor, carriesLantern, torchesOf,
} from '../game-engine/board/light.js';
import {
    isKey, toolsInParty, pickEdge, lockOutcome, lockLabels, dropBrokenTools, failLine, noToolsLine, LOCK_DC,
} from '../game-engine/board/lock-picking.js';
import {
    isHostileGround, partyRations, eatRations, ambushChance, watchPassive, surpriseCheck, wearsHeavyArmour,
    armourOffPenalty, pickAmbushers, ambushCells, alarmLine,
} from '../game-engine/campaign/dungeon-camp.js';
import { partyCondition, shouldAskPressOn, pickAsker, pressOnQuestion, safeDestination, toPlace } from '../game-engine/campaign/press-on.js';
import { kitCarrier, spendKitUse, partyKitUses, describeKitLeft } from '../game-engine/rules/healer-kit.js';
import { boardBiome } from '../game-engine/ui/pixel-art.js';
import { lockBonus } from '../game-engine/rules/field-uses.js';
import { rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import { getAbilityModifier } from '../dnd-system.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { defaultGuards, MAX_GUARDS, SETTLED } from '../game-engine/campaign/camp.js';
import { guardsOf, dutyHolder } from '../game-engine/campaign/formation.js';
import { normalizeTerrain, unlockDoor, breakDoor, isPassable } from '../game-engine/board/terrain.js';
import { EDGE_UP } from '../game-engine/combat/maneuvers.js';
import { deriveRooms, normalizeRooms, getRoomBehindDoor, enemiesInRoom } from '../game-engine/campaign/campaign-map.js';
import { nameRoomsFromZones } from '../game-engine/board/zones.js';
import { countedName } from '../game-engine/campaign/narration-notes.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { POPUP_TYPE, Popup } from '../popup.js';
import { TORCH_KEY, BROKEN_REST_KEY, FIELD_LIGHT_KEY } from './keys.js';
import { partyMembers, currentBoardName, currentLocationName, combatEncounter, setCurrentBoardName } from './state.js';
import { getActiveBoardContext, persistBoardTerrain, toggleBoardDoor, isBoardWon } from './board.js';
import { getLocationBoards, hereLocation, saveCurrentBoard, lastHub } from './world.js';
import { getCampaignCalendar, takeRest } from './time.js';
import { getPartyFormation } from './companions.js';
import { rollDiceDetailed } from './combat-rules.js';
import { startWaitingFight } from './combat-flow.js';
import { postCombatNarration, sayHere, soundCue } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';
import { renderLocationMapsPreview } from './board-view.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} member @returns {boolean} */
const standing = (member) => Boolean(member) && !member.dead && (Number(member.hp) || 0) > 0;

/** Lo que dicen los tableros de cuevas, criptas y mazmorras de verdad (no el dibujo por defecto). */
const DARK_WORDS = /s[oó]tano|mazmorra|calabozo|cripta|catacumba|tumba|mausoleo|panteon|panteón|osario|sepulcro|cueva|gruta|caverna|\bmina\b|t[uú]nel|alcantarilla|cloaca/i;

/** Los biomas con luz o al raso: ahí la localización de mazmorra no lo hace oscuro. */
const LIT_BIOMES = ['madera', 'exterior', 'calle', 'muelle', 'playa', 'pantano', 'nieve'];

// ---------------------------------------------------------------------------------------
// E2.1: la luz.

/**
 * La luz del tablero abierto, sin contar lo que lleva el grupo. Oscuro si el tablero lo dice
 * (`light`), si es una cueva, una cripta, un sótano o una mina (por su bioma o su nombre), o si
 * la localización es una mazmorra o una cueva y el tablero no es de madera ni al raso.
 *
 * @param {any} [board]
 * @returns {'bright'|'dim'|'dark'}
 */
export function boardAmbient(board = getActiveBoardContext().board) {
    if (!board) return 'bright';
    const place = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName) ?? hereLocation();
    const type = text(place?.locationType ?? place?.type).toLowerCase();
    const said = text(board.biome).toLowerCase();
    const biome = boardBiome({ biome: said, name: text(board.name), type });
    // El bioma dicho por el tablero manda; el que sale por defecto (mazmorra, para dibujar) no
    // dice nada de la luz: la granja, el robledal o la lonja no están a oscuras.
    const dark = ['cueva', 'cripta', 'mazmorra'].includes(said)
        || (DARK_WORDS.test(text(board.name)) && !LIT_BIOMES.includes(biome))
        || (['dungeon', 'cave'].includes(type) && !LIT_BIOMES.includes(biome));
    return ambientLight({ declared: board.light, dark });
}

/**
 * Los del grupo que están en el tablero abierto, con su casilla.
 *
 * @returns {Array<{member: any, x: number, y: number}>}
 */
function partyOnBoard() {
    return partyMembers
        .filter(m => standing(m) && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName))
        .map(m => ({ member: m, x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 }));
}

/**
 * Quién lanzó la Luz que sigue encendida (J19.10), si sigue.
 *
 * @returns {string}
 */
function fieldLightCaster() {
    const light = chat_metadata?.[FIELD_LIGHT_KEY];
    if (!light || !torchBurning(light, getCampaignCalendar())) return '';
    // La Luz guarda quién la lanzó por su nombre (`by`).
    const by = text(light.casterId ?? light.by ?? light.memberId).toLowerCase();
    const caster = by ? partyMembers.find(m => standing(m) && (text(m.id).toLowerCase() === by || text(m.name).toLowerCase() === by)) : null;
    if (caster) return text(caster.id);
    // Una Luz guardada sin quién: la lleva quien lance conjuros del grupo, o el primero.
    return text(partyMembers.find(m => standing(m))?.id);
}

/** Lo que se ha dicho de la oscuridad: una vez por tablero y parte del día. */
let darkSaid = '';

/** Un poco de memoria para no rehacer el plan en cada casilla de un mismo dibujo. */
let planCache = { key: '', at: 0, plan: /** @type {import('../game-engine/board/light.js').LightPlan|null} */ (null) };

/**
 * La luz que lleva el grupo ahora en el tablero abierto (sin encender nada).
 *
 * @returns {import('../game-engine/board/light.js').LightPlan|null} Nada fuera de un tablero.
 */
export function lightPlanNow() {
    const { board } = getActiveBoardContext();
    if (!board || !currentBoardName) return null;
    const calendar = getCampaignCalendar();
    const here = partyOnBoard();
    const key = `${currentLocationName}|${currentBoardName}|${JSON.stringify(chat_metadata?.[TORCH_KEY] ?? null)}|${here.map(p => `${p.member.id}@${p.x},${p.y}:${(p.member.items ?? []).length}`).join(';')}|${calendar?.day}:${calendar?.slotIndex}`;
    if (planCache.key === key && Date.now() - planCache.at < 1000) return planCache.plan;
    const plan = planLight({
        ambient: boardAmbient(board),
        party: here,
        torch: chat_metadata?.[TORCH_KEY] ?? null,
        calendar,
        chosenId: text(getPartyFormation()?.duties?.antorcha),
        fieldLightBy: fieldLightCaster(),
    });
    planCache = { key, at: Date.now(), plan };
    return plan;
}

/**
 * Encender la antorcha si hace falta (está oscuro, no arde ninguna y queda alguna): se gasta una
 * de la mochila y lo dice quien la lleva. Y si no hay con qué alumbrar, lo dice uno de los tuyos,
 * una vez. Lo llama el dibujo del tablero: no hace nada si no hay nada que hacer.
 *
 * @returns {boolean} Si ha encendido una.
 */
export function keepTorchLit() {
    if (!chat_metadata || !currentBoardName) return false;
    const plan = lightPlanNow();
    if (!plan || plan.ambient === 'bright') return false;
    const calendar = getCampaignCalendar();
    if (plan.lightTorch && plan.bearer && plan.torchFrom) {
        plan.torchFrom.items = spendTorch(plan.torchFrom.items);
        chat_metadata[TORCH_KEY] = { bearerId: text(plan.bearer.id), day: Number(calendar?.day) || 1, slotIndex: Number(calendar?.slotIndex) || 0 };
        planCache = { key: '', at: 0, plan: null };
        saveMetadata();
        savePartyState();
        const left = plan.torchesLeft === 0 ? 'Es la última que nos queda.' : `Nos quedan ${plan.torchesLeft}.`;
        const hand = plan.hand === 'shield' ? ' Me cuelgo el escudo a la espalda.' : '';
        const from = plan.torchFrom !== plan.bearer ? `${plan.torchFrom.name} me pasa una antorcha. ` : '';
        const said = `${from}La enciendo yo.${hand} ${left}`;
        setTimeout(() => sayHere(`🔥 [TABLERO] ${plan.bearer.name} enciende una antorcha. ${left}`, text(plan.bearer.name), said), 0);
        return true;
    }
    const nothing = plan.carried.length === 0 && plan.ambient === 'dark';
    const key = `${currentLocationName}|${currentBoardName}|${calendar?.day}:${calendar?.slotIndex}`;
    if (nothing && darkSaid !== key) {
        darkSaid = key;
        const seers = partyOnBoard().filter(p => darkvisionOf(p.member) > 0).map(p => p.member);
        const speaker = partyOnBoard().find(p => p.member !== partyMembers[0])?.member ?? partyMembers[0];
        const said = seers.length > 0
            ? `Aquí no hay ni una luz. ${seers.map(m => m.name).join(' y ')} ${seers.length > 1 ? 'ven' : 've'} a oscuras; los demás vamos a ciegas.`
            : 'No veo ni mis manos. Sin antorchas vamos a ciegas, y lo que viva aquí abajo sí que nos ve.';
        setTimeout(() => sayHere('🌑 [TABLERO] A oscuras: nadie lleva luz.', text(speaker?.name), said), 0);
    }
    return false;
}

/**
 * La luz para dibujarla: la del sitio y los focos, con la línea de la cabecera. Nada si se ve bien.
 *
 * @returns {{ambient: 'dim'|'dark', sources: ReturnType<typeof lightSources>, note: string,
 *   seers: Array<{name: string, x: number, y: number, darkvision: number}>}|null}
 */
export function lightForBoard() {
    const plan = lightPlanNow();
    if (!plan || plan.ambient === 'bright') return null;
    const seers = partyOnBoard().map(p => ({ name: text(p.member.name), x: p.x, y: p.y, darkvision: darkvisionOf(p.member) }));
    return {
        ambient: plan.ambient,
        sources: lightSources(plan.carried),
        note: describeLight(plan, seers),
        seers: seers.filter(s => s.darkvision > 0),
    };
}

/**
 * Quién está en una casilla del tablero, con su visión en la oscuridad.
 *
 * @param {{x: number, y: number}} cell
 * @returns {{x: number, y: number, darkvision: number}}
 */
function lookerAt(cell) {
    const x = Number(cell?.x) || 0;
    const y = Number(cell?.y) || 0;
    const member = partyMembers.find(m => standing(m) && (Number(m.mapPosition?.gridX) || 0) === x && (Number(m.mapPosition?.gridY) || 0) === y);
    if (member) return { x, y, darkvision: darkvisionOf(member) };
    const enemy = (combatEncounter.enemies ?? []).find(e => (Number(e.gridX) || 0) === x && (Number(e.gridY) || 0) === y && (Number(e.currentHp) || 0) > 0);
    if (enemy) {
        const template = getCurrentWorldEnemies().find(t => String(t.id) === String(enemy.templateId)) ?? {};
        return { x, y, darkvision: darkvisionOf({ ...template, ...enemy, name: text(enemy.name).replace(/\s+\d+$/, '') }, { monster: true }) };
    }
    return { x, y, darkvision: 0 };
}

/**
 * E2.1: lo que la luz le hace a un ataque de una casilla a otra: la desventaja de quien no ve a
 * su blanco, y la ventaja (con la marca `EDGE_UP`, que lee `attackEdge`) contra quien no ve a
 * quien le ataca.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {string[]}
 */
export function lightHindrance(from, to) {
    const plan = lightPlanNow();
    if (!plan || plan.ambient === 'bright') return [];
    const { terrain } = getActiveBoardContext();
    const edge = sightEdge({
        ambient: plan.ambient,
        sources: lightSources(plan.carried),
        attacker: lookerAt(from),
        target: lookerAt(to),
        terrain,
    });
    return [...edge.down, ...edge.up.map(reason => `${EDGE_UP}${reason}`)];
}

/**
 * E2.1: la luz de un ataque dicha para la tarjeta del blanco, o vacío si no cuenta.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {string}
 */
export function lightCardLine(from, to) {
    const plan = lightPlanNow();
    if (!plan || plan.ambient === 'bright') return '';
    const target = lookerAt(to);
    const edge = sightEdge({ ambient: plan.ambient, sources: lightSources(plan.carried), attacker: lookerAt(from), target, terrain: getActiveBoardContext().terrain });
    if (!edge.attackerSees && !edge.targetSees) return '🌑 A oscuras: ni le ves ni te ve. Se anulan: tirada normal.';
    if (!edge.attackerSees) return `🌑 A oscuras no le ves: atacas con desventaja.${target.darkvision > 0 ? ' Él a ti sí: ve en la oscuridad.' : ''}`;
    if (!edge.targetSees) return '🌑 No te ve venir en la oscuridad: atacas con ventaja.';
    return '';
}

/**
 * E2.1: cómo ve alguien lo que tiene alrededor (para buscar trampas o verlas de pasada).
 *
 * @param {any} member
 * @returns {ReturnType<typeof perceptionInLight>}
 */
export function lookingLight(member) {
    const plan = lightPlanNow();
    if (!plan || plan.ambient === 'bright') return perceptionInLight('bright');
    const cell = { x: Number(member?.mapPosition?.gridX) || 0, y: Number(member?.mapPosition?.gridY) || 0 };
    const level = lightLevelAt(cell, plan.ambient, lightSources(plan.carried), getActiveBoardContext().terrain);
    return perceptionInLight(seenAs(level, darkvisionOf(member), 0));
}

/**
 * E2.1 y E2.3: lo que le falta a la clase de armadura de alguien ahora: el escudo, si lleva la
 * antorcha en esa mano; la armadura pesada, si le han pillado durmiendo.
 *
 * @param {any} target
 * @returns {{penalty: number, why: string}}
 */
export function armourLoss(target) {
    if (!target || target.isEnemy || !partyMembers.includes(target)) return { penalty: 0, why: '' };
    let penalty = 0;
    /** @type {string[]} */
    const why = [];
    if (target.armourOff) {
        const lost = armourOffPenalty(target, getAbilityModifier(Number(target.dexterity) || 10));
        if (lost > 0) {
            penalty += lost;
            why.push('sin la armadura, que se quitó para dormir');
        }
    }
    if (currentBoardName && (handFor(target) === 'shield')) {
        const plan = lightPlanNow();
        if (plan && plan.bearer === target && plan.handLight && plan.ambient !== 'bright' && !plan.lightTorch) {
            const lost = shieldBonusOf(target);
            if (lost > 0) {
                penalty += lost;
                why.push(`sin escudo: lleva ${plan.handLight === 'farol' ? 'el farol' : 'la antorcha'}`);
            }
        }
    }
    return { penalty, why: why.join('; ') };
}

// ---------------------------------------------------------------------------------------
// E2.2: las cerraduras.

/**
 * La sala que hay detrás de una puerta, si nadie la ha visto aún, con lo que espera dentro.
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {number} gridW
 * @param {number} gridH
 * @returns {{room: any, inside: any[]}}
 */
function roomBehind(board, gx, gy, gridW, gridH) {
    const rooms = nameRoomsFromZones(normalizeRooms(board.rooms).length > 0
        ? board.rooms
        : deriveRooms(normalizeTerrain(board.terrain), gridW, gridH, {
            revealFrom: partyMembers.map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
        }), board.zones);
    const room = getRoomBehindDoor(/** @type {any} */ (rooms), gx, gy);
    if (!room || room.revealed || isBoardWon(currentLocationName, currentBoardName)) return { room: null, inside: [] };
    return { room, inside: enemiesInRoom(room, board.enemyPlacements ?? []) };
}

/**
 * E2.2 (idea 77): una puerta cerrada con llave. Con la llave se abre; si no, con ganzúas o a
 * golpes. Sin ganzúas no se fuerza (Daniel, 2026-10-03, como 5e): el botón no sale y uno de los
 * tuyos lo dice. Fallar hace ruido: lo que hay detrás abre desde dentro y sale. Fallar por mucho
 * con ganzúas las rompe (cosecha propia).
 *
 * @param {any} board
 * @param {number} gx
 * @param {number} gy
 * @param {number} gridW
 * @param {number} gridH
 * @returns {Promise<void>}
 */
export async function tryLockedDoor(board, gx, gy, gridW, gridH) {
    const living = partyMembers.filter(standing);
    const keyHolder = living.flatMap(m => (m.items ?? []).map((/** @type {any} */ item) => ({ member: m, item }))).find(({ item }) => isKey(item));
    const tools = toolsInParty(living);
    const picker = living.reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'sleight').modifier > skillModifier(top, 'sleight').modifier ? m : top), null);
    const edge = picker ? pickEdge({ withTools: Boolean(tools), proficient: skillModifier(picker, 'sleight').proficient }) : '';
    const trick = picker ? lockBonus(picker) : 0;
    const labels = lockLabels({ key: keyHolder?.item?.name ?? '', tools: tools?.item?.name ?? '', edge, trick });
    const body = $('<div class="tr-setback lk-root"></div>');
    body.append($('<h3></h3>').text('Puerta cerrada con llave'));
    body.append($('<p></p>').text(keyHolder
        ? `${keyHolder.member.name} lleva ${keyHolder.item.name}.`
        : tools ? `Nadie lleva la llave. ${tools.member.name} lleva ${String(tools.item.name).toLowerCase()}.` : 'Nadie lleva la llave ni ganzúas.'));
    // Sin ganzúas no se fuerza: lo dice uno de los tuyos (D-J60), con lo que queda.
    const noTools = tools ? '' : noToolsLine({ key: Boolean(keyHolder) });
    if (noTools) {
        const speaker = living.find(m => m !== partyMembers[0]) ?? living[0];
        const say = $('<p class="lk-say"></p>');
        say.append($('<b></b>').text(`${text(speaker?.name) || 'Alguien'}: `), document.createTextNode(`«${noTools}»`));
        body.append(say);
    }
    body.append($('<p class="lk-risk"></p>').text('Si falla, se oye al otro lado.'));
    const picked = await new Popup(body[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: 'Dejarla',
        customButtons: [
            ...(keyHolder ? [{ text: labels.key, result: 31, classes: ['lk-key'] }] : []),
            ...(labels.pick ? [{ text: labels.pick, result: 32, classes: ['lk-pick'] }] : []),
            { text: labels.force, result: 33, classes: ['lk-force'] },
        ],
    }).show();
    if (picked !== 31 && picked !== 32 && picked !== 33) return;
    if (picked === 32 && !tools) return;
    if (picked === 31) {
        board.terrain = unlockDoor(normalizeTerrain(board.terrain), gx, gy);
        persistBoardTerrain(board);
        toggleBoardDoor(board, gx, gy, true, gridW, gridH);
        return;
    }
    const how = picked === 32 ? 'pick' : 'force';
    const skill = how === 'pick' ? 'sleight' : 'athletics';
    const who = how === 'pick' ? picker : living.reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, skill).modifier > skillModifier(top, skill).modifier ? m : top), null);
    if (!who) return;
    const dc = how === 'pick' ? LOCK_DC.pick - trick : LOCK_DC.force;
    if (how === 'pick' && trick > 0) postCombatNarration(`🗝️ [BOARD] ${who.name} saca la ganzúa: la cerradura baja de CD ${LOCK_DC.pick} a ${dc}.`);
    const roll = rollCheck({
        member: who, skill, rollD20: () => rollDiceDetailed('1d20', 20).total, dc,
        edge: how === 'pick' ? edge : '', why: how === 'pick' && edge ? `con ${String(tools?.item?.name ?? 'las ganzúas').toLowerCase()} y sabe usarlas` : '',
    });
    if (!roll) return;
    postCombatNarration(roll.said);
    const result = lockOutcome({ how, total: roll.total, natural: roll.natural, dc, withTools: how === 'pick' && Boolean(tools) });
    if (result.opened) {
        // Idea 23: a golpes, la puerta no se abre: se rompe, y ya no se cierra.
        board.terrain = how === 'force' ? breakDoor(normalizeTerrain(board.terrain), gx, gy) : unlockDoor(normalizeTerrain(board.terrain), gx, gy);
        persistBoardTerrain(board);
        if (how === 'force') postCombatNarration(`🪓 [BOARD] La puerta de (${gx + 1}, ${gy + 1}) salta a golpes: queda rota, y ya no se cierra.`);
        toggleBoardDoor(board, gx, gy, true, gridW, gridH);
        return;
    }
    if (result.broke && tools) {
        tools.member.items = dropBrokenTools(tools.member.items, tools.item);
        savePartyState();
        renderPartyMembers();
        toastr.warning(`${tools.member.name} se queda sin ${String(tools.item.name).toLowerCase()}: se han roto en la cerradura.`, 'Las ganzúas', { timeOut: 9000 });
    }
    const { inside } = roomBehind(board, gx, gy, gridW, gridH);
    const heard = inside.length > 0;
    const note = `🔔 [TABLERO] ${who.name} no puede con la cerradura${result.broke ? ' y rompe las ganzúas' : ''}: ${heard ? 'al otro lado lo han oído.' : 'nadie parece oírlo.'}`;
    sayHere(note, text(who.name), failLine({ how, broke: result.broke, heard, tools: tools?.item?.name ?? '' }));
    soundCue(heard ? 'door' : 'miss');
    if (!heard) {
        toastr.info('La cerradura aguanta. Se puede volver a probar, pero cada fallo se oye.', 'Puerta cerrada');
        return;
    }
    // Lo que había detrás lo ha oído: abre desde dentro y sale a por vosotros.
    toastr.warning('Os han oído: abren desde dentro.', '¡La sala de al lado!', { timeOut: 9000 });
    board.terrain = unlockDoor(normalizeTerrain(board.terrain), gx, gy);
    persistBoardTerrain(board);
    toggleBoardDoor(board, gx, gy, true, gridW, gridH);
}

// ---------------------------------------------------------------------------------------
// E2.3: dormir en la mazmorra.

/** Si el descanso que sigue es el que una emboscada dejó a medias (no se vuelve a pagar ni a tirar). */
let resumingRest = false;

/**
 * Si aquí dormir es dormir en territorio hostil: en un tablero oscuro, o en uno de una localización
 * que es mazmorra o cueva.
 *
 * @returns {boolean}
 */
export function hostileHere() {
    const { board } = getActiveBoardContext();
    if (!board || !currentBoardName) return false;
    const place = hereLocation();
    return isHostileGround({ darkBoard: boardAmbient(board) === 'dark', locationType: text(place?.locationType ?? place?.type) });
}

/**
 * Los que pueden llegar de noche: los bichos de los tableros de este sitio (los de aquí), o los
 * del mundo si el sitio no tiene.
 *
 * @returns {Array<{name: string, cr: number}>}
 */
function nightComers() {
    const templates = getCurrentWorldEnemies();
    const place = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    const names = new Set(getLocationBoards(place).flatMap((/** @type {any} */ b) => (b.enemyPlacements ?? b.enemies ?? []).map((/** @type {any} */ p) => text(p?.name).toLowerCase())));
    const local = templates.filter(t => names.has(text(t.name).toLowerCase()) && !t.boss);
    const pool = local.length > 0 ? local : templates.filter(t => !t.boss);
    return pool.map(t => ({ name: text(t.name), cr: Number(t.cr) || 0 }));
}

/**
 * E2.3: antes de un descanso largo en la mazmorra. Pide una ración por cabeza (sin ellas, no se
 * duerme aquí) y tira por la emboscada; si llega, la pelea empieza ya y el descanso queda a
 * medias, para reanudarlo al ganar.
 *
 * @param {'corto'|'largo'} kind
 * @param {string} under Bajo techo o al raso (la posada, el campamento): ahí no.
 * @returns {Promise<boolean>} Si se sigue con el descanso.
 */
export async function dungeonRestGate(kind, under = '') {
    if (kind !== 'largo' || under || combatEncounter.active || !chat_metadata) return true;
    if (resumingRest) return true;
    if (!hostileHere()) return true;
    const living = partyMembers.filter(m => standing(m) && !(/** @type {any} */ (m)).summon);
    const speaker = living.find(m => m !== partyMembers[0]) ?? living[0];
    const meal = eatRations(living, partyMembers);
    if (!meal.ok) {
        const have = partyRations(partyMembers);
        sayHere(`🍖 [DESCANSO] No hay raciones para todos (${have} de ${living.length}): aquí no se duerme.`, text(speaker?.name),
            `Aquí abajo no se duerme sin comer, y no hay raciones para todos: quedan ${have} y somos ${living.length}. O volvemos, o seguimos sin dormir.`);
        toastr.warning(`Para dormir en la mazmorra hace falta una ración por cabeza (tenéis ${have} de ${living.length}).`, 'Sin raciones', { timeOut: 9000 });
        return false;
    }
    for (const [member, items] of meal.items) member.items = items;
    savePartyState();
    postCombatNarration(`🍖 [DESCANSO] Cenáis en la oscuridad: ${meal.eaten} ${meal.eaten === 1 ? 'ración' : 'raciones'} menos.`);

    const calendar = getCampaignCalendar();
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mazmorra-noche', currentLocationName, currentBoardName, String(calendar?.day ?? 1)));
    const lit = Boolean(lightPlanNow()?.carried.length);
    if (!(random() < ambushChance({ light: lit }))) return true;
    const comers = nightComers();
    const names = pickAmbushers({ candidates: comers, partySize: living.length, random });
    const { board, terrain, gridWidth, gridHeight } = getActiveBoardContext();
    if (names.length === 0 || !board) return true;

    // La guardia: el vigía de la formación primero (J7.4), y quien mejor oye.
    const perception = (/** @type {any} */ m) => skillModifier(m, 'perception').modifier;
    const guardIds = guardsOf(getPartyFormation(), living, defaultGuards(living, perception), MAX_GUARDS);
    const guards = living.filter(m => guardIds.includes(String(m.id)));
    const dark = boardAmbient(board) === 'dark' && !lit;
    const watch = guards.map(m => ({ name: text(m.name), passive: watchPassive({ perception: perception(m), dark, darkvision: darkvisionOf(m) }) }));
    const templates = getCurrentWorldEnemies();
    const stealth = names.map(name => {
        const template = templates.find(t => text(t.name).toLowerCase() === name.toLowerCase());
        const bonus = Number(template?.stealth) || getAbilityModifier(Number(template?.dexterity) || 10);
        return rollDiceDetailed('1d20', 20).total + bonus;
    });
    const surprise = surpriseCheck({ guards: watch, stealth });
    // Quien dormía en armadura pesada se la había quitado (5e: ponérsela son diez minutos).
    const naked = living.filter(m => !guards.includes(m) && wearsHeavyArmour(m));
    for (const member of naked) /** @type {any} */ (member).armourOff = true;
    chat_metadata[BROKEN_REST_KEY] = { day: Number(calendar?.day) || 1, place: currentLocationName, board: currentBoardName };
    saveMetadata();
    savePartyState();

    const cells = ambushCells({
        party: partyOnBoard().map(p => ({ x: p.x, y: p.y })),
        free: (x, y) => isPassable(terrain, x, y, gridWidth, gridHeight) && !(board.enemyPlacements ?? []).some((/** @type {any} */ p) => Number(p.x) === x && Number(p.y) === y),
        width: gridWidth, height: gridHeight, count: names.length, random,
    });
    const placements = names.slice(0, cells.length).map((name, i) => ({ name, x: cells[i].x, y: cells[i].y }));
    if (placements.length === 0) return true;
    const foes = countedName(names[0], placements.length);
    const watcher = surprise.best?.name || text(speaker?.name);
    const told = surprise.surprised
        ? `De noche llegan ${foes}${surprise.best ? `: ${surprise.best.name} no los oye (pasiva ${surprise.best.passive} contra Sigilo ${surprise.worst})` : ': nadie hacía guardia'}. Os pillan por sorpresa.`
        : `De noche llegan ${foes}, pero ${surprise.best?.name} los oye venir (pasiva ${surprise.best?.passive} contra Sigilo ${surprise.worst}).`;
    const armourNote = naked.length > 0 ? ` ${naked.map(m => m.name).join(' y ')} ${naked.length > 1 ? 'pelean' : 'pelea'} sin armadura: se la ${naked.length > 1 ? 'quitaron' : 'quitó'} para dormir.` : '';
    sayHere(`⚔️ [DESCANSO] ${told}${armourNote}`, watcher, alarmLine({ surprised: surprise.surprised, foes }));
    toastr.warning(`${told}${armourNote}`, '¡Emboscada!', { timeOut: 12000 });
    startWaitingFight(placements, {
        surprised: surprise.surprised,
        nightAmbush: true,
        said: surprise.surprised ? '[COMBAT] ¡Emboscada en la oscuridad! Os han pillado durmiendo.' : '[COMBAT] ¡Os atacan de noche! La guardia ha dado la voz a tiempo.',
    });
    return false;
}

/**
 * E2.3: al acabar una pelea, cada uno vuelve a tener su armadura (la de una emboscada se la pone
 * después); y si se perdió, el descanso a medias se olvida.
 *
 * @param {string} reason
 */
export function dungeonFightEnded(reason) {
    let changed = false;
    for (const member of /** @type {any[]} */ (partyMembers)) {
        if (!member.armourOff) continue;
        delete member.armourOff;
        changed = true;
    }
    if (changed) savePartyState();
    if (reason !== 'victory' && chat_metadata?.[BROKEN_REST_KEY]) {
        delete chat_metadata[BROKEN_REST_KEY];
        saveMetadata();
    }
}

/**
 * E2.3: si una emboscada dejó el descanso largo a medias aquí, se termina (2024: se reanuda, una
 * hora más), sin volver a pagar raciones ni a tirar.
 *
 * @returns {Promise<boolean>} Si había uno que reanudar.
 */
async function resumeBrokenRest() {
    const broken = chat_metadata?.[BROKEN_REST_KEY];
    if (!broken) return false;
    delete chat_metadata[BROKEN_REST_KEY];
    saveMetadata();
    if (broken.place !== currentLocationName) return false;
    const living = partyMembers.filter(standing);
    const speaker = living.find(m => m !== partyMembers[0]) ?? living[0];
    sayHere('🌙 [DESCANSO] Acabada la pelea, se vuelve a dormir: el descanso largo se termina.', text(speaker?.name),
        'Se acabó. A dormir otra vez, que aún queda noche. Esta vez, con un ojo abierto.');
    resumingRest = true;
    try {
        await takeRest('largo');
    } finally {
        resumingRest = false;
    }
    return true;
}

// ---------------------------------------------------------------------------------------
// E2.4: seguir o volver, y el kit de curandero.

/**
 * Si en este sitio queda algo por delante: otra pelea escrita en este tablero o en otro del sitio.
 *
 * @returns {boolean}
 */
function moreAhead() {
    const place = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
    return getLocationBoards(place).some((/** @type {any} */ b) => (b.enemyPlacements ?? b.enemies ?? []).length > 0 && !isBoardWon(currentLocationName, b.name));
}

/**
 * E2.4: tras ganar una pelea en la mazmorra (al pulsar «Seguir…» o «Registrar la sala» en la
 * pantalla de la victoria). Si una emboscada cortó el descanso, se termina; si no, y queda algo
 * por delante y alguien va tocado, uno de los tuyos pregunta: seguir, dormir ahí dentro (E2.3) o
 * volver.
 *
 * @param {{ask?: boolean}} [options] `ask`: si toca preguntar (no, si lo que sigue es una escena del
 *   hilo o lo siguiente de la campaña en otro sitio: eso va primero).
 * @returns {Promise<boolean>} Si se sigue como iba (falso: habéis vuelto, y no hay que hacer más).
 */
export async function afterDungeonVictory({ ask = true } = {}) {
    if (!currentBoardName || combatEncounter.active || !chat_metadata) return true;
    if (await resumeBrokenRest()) return true;
    if (!ask) return true;
    const { board } = getActiveBoardContext();
    const place = hereLocation();
    const type = text(place?.locationType ?? place?.type).toLowerCase();
    const ambient = boardAmbient(board);
    const dungeon = ambient !== 'bright' || ['dungeon', 'cave'].includes(type);
    const here = partyMembers.filter(m => !m.dead && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName));
    const condition = partyCondition(here);
    if (!shouldAskPressOn({ dungeon, moreAhead: moreAhead(), condition })) return true;
    const living = here.filter(standing);
    const hero = partyMembers.find(m => !m.guest) ?? partyMembers[0];
    const healer = dutyHolder(getPartyFormation(), 'cura', living);
    const asker = pickAsker(living, { heroId: text(hero?.id), healerId: text(healer?.id) }) ?? hero;
    const destination = safeDestination({ guild: Boolean(lastHub), settled: SETTLED.includes(type) });
    const question = pressOnQuestion({
        asker,
        condition,
        supplies: {
            torches: living.reduce((sum, m) => sum + torchesOf(m), 0),
            rations: partyRations(partyMembers),
            kitUses: partyKitUses(partyMembers),
            mouths: living.length,
            needsLight: ambient !== 'bright',
            lantern: living.some(carriesLantern),
        },
        destination: destination.where,
        campHere: hostileHere(),
    });
    const { askInScene } = await import('../game-engine/ui/vn-question.js');
    const go = await askInScene({
        title: 'Tras la pelea', who: asker, notes: question.notes, question: question.question,
        yes: question.yes, no: question.no, other: question.other, kind: 'seguir',
    });
    if (go === true) {
        postCombatNarration(`➡️ [TABLERO] Seguís adelante (${question.notes[0]}).`);
        return true;
    }
    if (go === 'other') {
        // E2.3: dormir aquí dentro: raciones, y lo que pueda llegar de noche.
        postCombatNarration('🌙 [TABLERO] Os quedáis a dormir dentro de la mazmorra.');
        await takeRest('largo');
        return !combatEncounter.active;
    }
    postCombatNarration(`↩️ [TABLERO] Volvéis ${toPlace(destination.where)}: se pierde el día.`);
    setCurrentBoardName('');
    saveCurrentBoard();
    renderLocationMapsPreview();
    await takeRest('largo', { under: destination.under });
    toastr.info(`Habéis vuelto ${toPlace(destination.where)} y dormido. Lo que queda de la mazmorra os espera mañana.`, 'Volver', { timeOut: 9000 });
    if (isShellOpen()) refreshGameShell();
    return false;
}

/**
 * E2.4: estabilizar con el kit de curandero (2024: un uso, sin tirar Medicina). Lo gasta quien
 * atiende si lo lleva; si no, quien lo lleve se lo pasa.
 *
 * @param {any} helper
 * @returns {{used: boolean, line: string}}
 */
export function useHealerKit(helper) {
    const carrier = kitCarrier(partyMembers, helper);
    if (!carrier) return { used: false, line: '' };
    const spent = spendKitUse(carrier.items);
    if (!spent.spent) return { used: false, line: '' };
    carrier.items = spent.items;
    savePartyState();
    const from = carrier === helper ? 'con su kit de curandero' : `con el kit de curandero de ${carrier.name}`;
    return { used: true, line: `${from} (${describeKitLeft(spent.left)})` };
}

/** Para las pruebas: olvidar lo dicho y lo calculado. */
export function resetDungeonMemory() {
    darkSaid = '';
    planCache = { key: '', at: 0, plan: null };
    resumingRest = false;
}

