/**
 * E7 de wiki/ROADMAP_ENTRETENIDO.md, «Sin fricción aburrida» (la fase G5 de ROADMAP_AUTOMATIZAR):
 * el pegamento con la partida de lo que el juego hace por ti.
 *
 * - **E7.2, resolver rápido** (`combat/quick-resolve.js`): antes de una pelea claramente vuestra,
 *   la ficha «Resolver rápido» en la decisión. La pelea la juega el motor de siempre, con todos en
 *   manos del juego y sin enseñarla (`quiet-fight.js`): la vida, los conjuros, el botín y los PX
 *   son los de verdad, y la pantalla de victoria lo dice.
 *
 * - **E7.1, explorar hacia delante** (`board/explore-ahead.js`): la ficha del tablero; el grupo
 *   avanza en formación y se para ante alguien, una trampa, un cofre, una puerta o la oscuridad.
 * - **E7.3, equipar lo mejor** (`rules/best-gear.js`): el botón de la ficha, y los compañeros que
 *   lleva el juego se ponen solos lo mejor de lo suyo tras ganar.
 * - **E7.4, subir de nivel solos** (`rules/level-advice.js`, `levelUpByRole` en level-up.js): los
 *   compañeros que lleva el juego suben con lo recomendado para su papel.
 *
 * Todo lo que se dice lo dice alguien que está (D-J60); lo demás va en un aviso fuera de la caja.
 */

import { chat_metadata } from '../../script.js';
import { getCurrentWorldEnemies, METADATA_KEY } from '../world-info.js';
import { quickResolveOffer } from '../game-engine/combat/quick-resolve.js';
import { hasScenario } from '../game-engine/combat/scenario-board.js';
import { sleepersOf } from '../game-engine/board/sleepers.js';
import { boardBand, levelAdjustment, levelGap, partyLevelOf, adjustEnemy } from '../game-engine/combat/level-adjust.js';
import { readNemeses } from '../game-engine/campaign/nemesis.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { bestGear, applyGear } from '../game-engine/rules/best-gear.js';
import { planExploreAhead, aheadLine, aheadNotice, thingKey } from '../game-engine/board/explore-ahead.js';
import { marchOrder } from '../game-engine/board/group-move.js';
import { parseCellKey } from '../game-engine/board/terrain.js';
import { hazardsAt } from '../game-engine/board/hazards.js';
import { normalizeFog, DEFAULT_SIGHT_FEET } from '../game-engine/board/fog-of-war.js';
import { fogOnFor } from '../game-engine/board/board-camera.js';
import { darkvisionOf, LIGHT_SOURCES } from '../game-engine/board/light.js';
import { awakePlacements } from '../game-engine/campaign/campaign-map.js';
import { skillModifier } from '../game-engine/rules/checks.js';
import { NEMESES_KEY, TORCH_KEY } from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers } from './state.js';
import { getActiveBoardContext, threadBoardsHere, groupMoveTo, isBoardWon, knownTrapsHere } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { hereLocation, lastLevelPlan } from './world.js';
import { runCombatTurnLoop, startWaitingFight, waitingSummary } from './combat-flow.js';
import { postCombatNarration, sayHere } from './narration.js';
import { setQuietFight } from './quiet-fight.js';
import { getPartyFormation } from './companions.js';
import { lightPlanNow, keepTorchLit } from './dungeon.js';
import { syncCurse } from './sheet.js';
import { savePartyState, renderPartyMembers } from './roster.js';
import { controlOf } from './spell-turn.js';
import { canLevelUp, levelUpByRole } from './level-up.js';
import { fightWaitingHere } from './fight-entry.js';
import { silentNow } from './silent.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} member @returns {boolean} */
const standing = (member) => Boolean(member) && !member.dead && (Number(member.hp) || 0) > 0;

// ---------------------------------------------------------------------------------------
// E7.2: resolver rápido.

/** Cuántas vueltas del turno como mucho: con una pelea fácil sobran. */
const QUICK_LOOPS = 60;

/**
 * Los enemigos que entrarían en la pelea (los que esperan y los que duermen, que se despiertan
 * con el ruido), con su ficha del mundo y el ajuste de nivel del tablero (D-J56), si lo lleva.
 *
 * @param {Array<{name: string, x?: number, y?: number}>} placements
 * @returns {any[]}
 */
function foesFor(placements) {
    const board = getActiveBoardContext().board;
    const sleeping = sleepersOf(board?.enemyPlacements);
    const templates = getCurrentWorldEnemies();
    const all = [...(Array.isArray(placements) ? placements : []), ...sleeping.filter(s => !placements.includes(s))];
    // El ajuste de nivel, como `levelAdjustHere` en combat-flow.js: solo en un tablero escrito de una campaña.
    const name = text(board?.name);
    const level = partyLevelOf(partyMembers);
    const written = lastLevelPlan && board && (board.packBoardId || lastLevelPlan.actOf?.[name.toLowerCase()]);
    const adjustment = written && level.size > 0 ? levelAdjustment(levelGap(level.level, boardBand(lastLevelPlan, name))) : null;
    /** @type {any[]} */
    const foes = [];
    for (const placement of all) {
        const template = /** @type {any} */ (templates.find(t => fold(t.name) === fold(placement?.name)));
        if (!template) continue;
        const foe = { ...template, boss: Boolean(template.boss || /** @type {any} */ (placement).boss), nemesis: /** @type {any} */ (placement).nemesis };
        foes.push(adjustment ? adjustEnemy(foe, adjustment) : foe);
    }
    // Los esbirros de más que pone el ajuste: copias del más flojo.
    const extra = Math.max(0, Math.floor(Number(adjustment?.minions) || 0));
    const weakest = [...foes].sort((a, b) => (Number(a.cr) || 0) - (Number(b.cr) || 0))[0];
    for (let i = 0; i < extra && weakest; i++) foes.push({ ...weakest });
    return foes;
}

/**
 * E7.2: si la pelea que espera en el tablero abierto se puede resolver rápido, y lo que costará.
 *
 * @param {Array<{name: string, x?: number, y?: number}>} placements Los que os han visto.
 * @returns {import('../game-engine/combat/quick-resolve.js').QuickOffer|null} Nada si no se ofrece.
 */
export function quickOfferHere(placements) {
    try {
        if (combatEncounter.active || !currentBoardName) return null;
        const board = getActiveBoardContext().board;
        if (!board) return null;
        const foes = foesFor(placements);
        const nemeses = readNemeses(chat_metadata?.[NEMESES_KEY]).filter(n => !n.gone);
        const offer = quickResolveOffer({
            party: partyMembers.filter(m => standing(m) && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName)),
            foes,
            blockers: {
                story: threadBoardsHere(hereLocation()).includes(currentBoardName),
                scenario: hasScenario(board),
                waves: Array.isArray(board.waves) && board.waves.some((/** @type {any} */ w) => w && !w.done),
                ward: Boolean(board.ward),
                brawl: Boolean(board.brawl),
                nemesis: foes.some(f => f.nemesis) || nemeses.some(n => foes.some(f => fold(f.name) === fold(n.name))),
            },
            seed: `${text(chat_metadata?.[METADATA_KEY])}|${currentLocationName}|${currentBoardName}`,
        });
        return offer.offer ? offer : null;
    } catch (error) {
        console.error('[E7.2] no se pudo mirar si la pelea es fácil', error);
        return null;
    }
}

/**
 * E7.2: resolver la pelea de una vez: la de siempre, con todos en manos del juego y sin
 * enseñarla. Si se complica (no debería: solo se ofrece cuando es claramente vuestra), se
 * devuelve el mando y se sigue jugando como siempre.
 *
 * @param {Array<{name: string, x: number, y: number}>} placements
 * @returns {boolean} Si ha acabado.
 */
export function resolveQuickly(placements) {
    if (combatEncounter.active) return false;
    setQuietFight(true);
    try {
        startWaitingFight(placements, { said: `⏩ [COMBAT] Resolver rápido: ${waitingSummary(placements)}.` });
        for (let i = 0; i < QUICK_LOOPS && combatEncounter.active; i++) runCombatTurnLoop(true);
    } catch (error) {
        console.error('[E7.2] la pelea rápida', error);
    } finally {
        setQuietFight(false);
    }
    // El cartel de «¡Iniciativa!» no hace falta: la pelea ya ha acabado.
    document.querySelectorAll('.ib-banner').forEach(banner => banner.remove());
    if (combatEncounter.active) {
        postCombatNarration('⚠️ [COMBAT] La pelea se ha complicado: seguís vosotros, turno a turno.');
        toastr.info('La pelea se ha complicado: seguís vosotros, turno a turno.', 'Resolver rápido');
        runCombatTurnLoop(true);
    }
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    return !combatEncounter.active;
}

// ---------------------------------------------------------------------------------------
// E7.1: explorar hacia delante.

/** Lo que ya se ha dicho al explorar en este tablero (para no pararse dos veces en lo mismo). */
let aheadMemory = { board: '', location: '', seen: /** @type {string[]} */ ([]) };

/** @returns {any[]} Los del grupo en pie en el tablero abierto. */
function partyHere() {
    return partyMembers.filter(m => standing(m) && (!m.mapPosition?.locationName || m.mapPosition.locationName === currentLocationName));
}

/**
 * E7.1: si se puede explorar hacia delante ahora: en un tablero, fuera de combate, con alguien en
 * pie y sin una pelea a punto de empezar.
 *
 * @returns {boolean}
 */
export function canExploreAhead() {
    return Boolean(currentBoardName) && !combatEncounter.active && partyHere().length > 0 && !fightWaitingHere();
}

/**
 * Lo que hay en el tablero abierto que para la marcha: los enemigos (despiertos o dormidos), las
 * trampas ya vistas, los cofres y las puertas cerradas.
 *
 * @param {any} board
 * @returns {import('../game-engine/board/explore-ahead.js').AheadThing[]}
 */
function thingsOnBoard(board) {
    /** @type {import('../game-engine/board/explore-ahead.js').AheadThing[]} */
    const things = [];
    if (!isBoardWon(currentLocationName, currentBoardName)) {
        for (const placement of awakePlacements(board?.rooms, board?.enemyPlacements ?? [])) {
            things.push({ kind: 'foe', x: Number(placement.x) || 0, y: Number(placement.y) || 0, name: text(placement.name) });
        }
    }
    for (const key of knownTrapsHere()) {
        const cell = parseCellKey(key);
        if (cell) things.push({ kind: 'trap', x: cell.x, y: cell.y, name: text(hazardsAt(board, cell.x, cell.y)[0]?.name) });
    }
    for (const [key, cell] of Object.entries(board?.terrain?.cells ?? {})) {
        const at = parseCellKey(key);
        if (!at || !cell) continue;
        if (cell.type === 'chest') things.push({ kind: 'chest', x: at.x, y: at.y });
        else if (cell.type === 'door' && !cell.open) things.push({ kind: 'door', x: at.x, y: at.y });
    }
    return things;
}

/**
 * Quien lo ve y lo dice: el de mejor Percepción pasiva de los que no son tu héroe (D-J60: el
 * héroe solo habla en lo que eliges). Nadie, si vas solo.
 *
 * @param {any[]} here
 * @returns {any|null}
 */
function spotter(here) {
    const mates = here.filter(m => m !== partyMembers[0] && !silentNow(m));
    return mates.map(m => ({ m, passive: 10 + skillModifier(m, 'perception').modifier }))
        .sort((a, b) => b.passive - a.passive)[0]?.m ?? null;
}

/**
 * E7.1: el grupo avanza en formación hasta lo siguiente que importa (alguien, una trampa, un
 * cofre, una puerta, la oscuridad) y se para; quien lo ve lo dice.
 *
 * @returns {Promise<import('../game-engine/board/explore-ahead.js').AheadPlan|null>}
 */
export async function exploreAheadNow() {
    if (!canExploreAhead()) return null;
    const { board, terrain, gridWidth, gridHeight } = getActiveBoardContext();
    if (!board) return null;
    if (aheadMemory.board !== currentBoardName || aheadMemory.location !== currentLocationName) {
        aheadMemory = { board: currentBoardName, location: currentLocationName, seen: [] };
    }
    // E2.1: si está oscuro y queda alguna antorcha, se enciende antes de echar a andar.
    keepTorchLit();
    const here = partyHere();
    const order = getPartyFormation()?.order ?? [];
    const leader = /** @type {any} */ (marchOrder(here, order)[0]);
    const light = lightPlanNow();
    const dark = Boolean(light && light.ambient === 'dark');
    const seeing = Math.max(0, ...here.map(m => darkvisionOf(m)));
    const lit = (light?.carried ?? []).reduce((best, c) => {
        const spec = /** @type {Record<string, {bright: number, dim: number}>} */ (LIGHT_SOURCES)[text(c.kind)];
        return Math.max(best, spec ? spec.bright + spec.dim : 0);
    }, 0);
    const canSee = !dark || lit > 0 || seeing > 0;
    const sightFeet = dark ? Math.max(lit, seeing) : DEFAULT_SIGHT_FEET;
    const trapsBefore = new Set(knownTrapsHere());
    const plan = planExploreAhead({
        terrain, gridWidth, gridHeight,
        start: { x: Number(leader?.mapPosition?.gridX) || 0, y: Number(leader?.mapPosition?.gridY) || 0 },
        things: thingsOnBoard(board),
        explored: fogOnFor(board, gridWidth, gridHeight) ? Object.keys(normalizeFog(board.fog).explored) : null,
        seen: aheadMemory.seen,
        sight: Math.max(1, Math.floor(sightFeet / 5)),
        canSee,
    });
    aheadMemory.seen = plan.seen;
    if (plan.path.length > 1) groupMoveTo(plan.to.x, plan.to.y);
    // Andando, quien va delante puede ver una trampa que nadie sabía (la marcha de siempre la para).
    const spotted = [...knownTrapsHere()].filter(key => !trapsBefore.has(key));
    /** @type {import('../game-engine/board/explore-ahead.js').AheadPlan} */
    let told = plan;
    if (spotted.length > 0) {
        const cell = parseCellKey(spotted[0]);
        const name = cell ? text(hazardsAt(board, cell.x, cell.y)[0]?.name) : '';
        told = { ...plan, kind: 'trap', found: cell ? [{ kind: 'trap', x: cell.x, y: cell.y, name }] : [] };
        if (cell) aheadMemory.seen = [...new Set([...aheadMemory.seen, thingKey({ kind: 'trap', x: cell.x, y: cell.y })])];
    }
    const line = aheadLine(told);
    const who = line ? spotter(here) : null;
    renderLocationMapsPreview();
    if (line && who) {
        sayHere(`👣 [TABLERO] ${aheadNotice(told)}`, text(who.name), line);
        // En el tablero, la frase sale en un bocadillo sobre quien lo ha visto (como los gritos).
        setTimeout(() => sayOverToken(who, line), 350);
    } else if (aheadNotice(told)) {
        toastr.info(aheadNotice(told), 'Explorar hacia delante');
    }
    return told;
}

/**
 * Un bocadillo con lo que dice alguien del grupo, sobre su ficha del tablero.
 *
 * @param {any} member
 * @param {string} line
 */
function sayOverToken(member, line) {
    const token = [...document.querySelectorAll('.wm-token')]
        .find(t => t instanceof HTMLElement && t.dataset.tokenId === String(member?.id) && t.offsetParent);
    if (!token) return;
    token.querySelectorAll('.wm-bark').forEach(old => old.remove());
    const bubble = document.createElement('div');
    bubble.className = 'wm-bark wm-bark-ahead';
    bubble.textContent = line;
    token.appendChild(bubble);
    setTimeout(() => bubble.remove(), 5000);
}

// ---------------------------------------------------------------------------------------
// E7.3: equipar lo mejor.

/**
 * Si alguien lleva la luz del grupo (E2.1): la antorcha encendida, el elegido en la formación o
 * quien la llevaría si hiciera falta en el tablero oscuro de ahora.
 *
 * @param {any} member
 * @returns {boolean}
 */
function carriesTheLight(member) {
    const id = text(member?.id);
    if (!id) return false;
    if (text(chat_metadata?.[TORCH_KEY]?.bearerId) === id) return true;
    if (text(getPartyFormation()?.duties?.antorcha) === id) return true;
    try {
        const plan = lightPlanNow();
        return Boolean(plan && plan.ambient !== 'bright' && text(plan.bearer?.id) === id);
    } catch {
        return false;
    }
}

/**
 * Lo que los demás llevan suelto en la mochila (sin ponérselo): también vale para equipar a otro.
 *
 * @param {any} member
 * @returns {import('../game-engine/rules/best-gear.js').GearPick[]}
 */
function looseFromMates(member) {
    /** @type {import('../game-engine/rules/best-gear.js').GearPick[]} */
    const pool = [];
    for (const mate of partyMembers) {
        if (mate === member || mate.dead) continue;
        const worn = new Set(Object.values(mate.equippedItems ?? {}).filter(Boolean).map(String));
        for (const item of Array.isArray(mate.items) ? mate.items : []) {
            if (item && !worn.has(String(item.id))) pool.push({ item, owner: String(mate.id) });
        }
    }
    return pool;
}

/**
 * E7.3: ponerle a alguien lo mejor que tiene a mano (y, si se pide, lo suelto de los demás), y
 * decir por qué.
 *
 * @param {any} member
 * @param {{fromMates?: boolean}} [options]
 * @returns {{changed: boolean, lines: string[]}}
 */
export function equipBestFor(member, { fromMates = true } = {}) {
    if (!member || member.dead) return { changed: false, lines: [] };
    const plan = bestGear({ member, pool: fromMates ? looseFromMates(member) : [], torchBearer: carriesTheLight(member) });
    if (!plan.better) return { changed: false, lines: plan.lines };
    const done = applyGear(member, plan, partyMembers);
    member.items = done.member.items;
    member.equippedItems = done.member.equippedItems;
    for (const mate of done.mates) {
        const from = partyMembers.find(m => String(m.id) === mate.id);
        if (from) from.items = mate.items;
    }
    // Idea 135: lo maldito que no se sabía se descubre al ponérselo.
    for (const change of plan.changes) {
        if (change.item?.cursed && change.item.identified === false) {
            change.item.identified = true;
            plan.lines.push(`${change.item.name} se le pega a la mano: ${change.item.curse?.label ?? 'está maldito'}.`);
        }
    }
    syncCurse(member);
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`🎒 [GRUPO] ${member.name} se equipa: ${plan.lines.join(' ')}`);
    return { changed: true, lines: plan.lines };
}

/**
 * E7.3: el botón de la ficha. Lo que cambia sale en un aviso (fuera de la caja de la novela).
 *
 * @param {any} member
 * @returns {boolean} Si ha cambiado algo.
 */
export function equipBestButton(member) {
    if (combatEncounter.active) {
        toastr.warning('En plena pelea no hay tiempo de cambiarse de todo.', 'Equipar lo mejor');
        return false;
    }
    const done = equipBestFor(member);
    if (!done.changed) {
        toastr.info(done.lines.length > 0 ? done.lines.join(' ') : 'Ya lleva lo mejor que tiene a mano.', `${member?.name ?? ''}: equipar lo mejor`, { timeOut: 8000 });
        return false;
    }
    toastr.success(done.lines.join(' '), `${member.name}: equipar lo mejor`, { timeOut: 10000 });
    if (isShellOpen()) refreshGameShell();
    return true;
}

/** @param {any} member @returns {boolean} Si lo lleva el juego (no es tu héroe). */
const movedByGame = (member) => Boolean(member) && member !== partyMembers[0] && !member.dead && controlOf(member) === 'engine';

/**
 * E7.3 (G5.5): los compañeros que lleva el juego se ponen lo mejor de lo suyo cuando les llega
 * algo mejor. Lo de los demás no lo cogen: eso lo reparte quien juega.
 *
 * @returns {string[]} Lo que se han puesto, en frases.
 */
export function autoEquipGameCompanions() {
    /** @type {string[]} */
    const notes = [];
    for (const member of partyMembers.filter(movedByGame)) {
        const done = equipBestFor(member, { fromMates: false });
        if (done.changed) notes.push(`${member.name}: ${done.lines[0]}`);
    }
    return notes;
}

// ---------------------------------------------------------------------------------------
// E7.4: subir de nivel solos.

/**
 * E7.4 (G5.4): los compañeros que lleva el juego suben de nivel solos, con lo recomendado para
 * su papel.
 *
 * @returns {Promise<string[]>} Lo que ha subido cada uno, en frases.
 */
export async function autoLevelGameCompanions() {
    /** @type {string[]} */
    const notes = [];
    for (const member of partyMembers.filter(movedByGame)) {
        if (!canLevelUp(member)) continue;
        const said = await levelUpByRole(member);
        if (said) notes.push(said);
    }
    return notes;
}

/**
 * Tras ganar (antes de la pantalla de victoria): los que lleva el juego se ponen lo mejor y suben
 * de nivel. Lo que hagan sale en la pantalla, con las mejoras del botín.
 *
 * @returns {Promise<string[]>}
 */
export async function afterVictoryChores() {
    const notes = [...autoEquipGameCompanions(), ...await autoLevelGameCompanions()];
    if (notes.length > 0 && isShellOpen()) refreshGameShell();
    return notes;
}
